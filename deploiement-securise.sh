#!/usr/bin/env bash
#
# deploiement-securise.sh
# Mise à jour de gestion-stock-smt-V2 en production (Red Hat), avec rollback.
#
# Principe : aucune perte de données. Le script s'arrête et remet l'application
# dans son état antérieur dès qu'une étape échoue ou qu'une opération
# destructrice est détectée. La base n'est jamais modifiée avant qu'une
# sauvegarde ait été prise ET vérifiée par restauration réelle.
#
# Ce script n'appelle JAMAIS `npm run db:seed` ni `npm run db:reset` :
# prisma/seed.ts commence par dix deleteMany() et détruirait toute la base.
#
# Usage :
#   ./deploiement-securise.sh [options]
#
#   --dry-run           Tout vérifier (sauvegarde, diff SQL) sans rien appliquer.
#   --app-dir CHEMIN    Répertoire de l'application (défaut : répertoire courant).
#   --branch NOM        Branche à déployer (défaut : main).
#   --backup-dir CHEMIN Répertoire des sauvegardes (défaut : ~/sauvegardes-stock).
#   --pm2-name NOM      Nom du process PM2 (détecté automatiquement sinon).
#   --port PORT         Port HTTP local (sinon détecté automatiquement).
#   --url URL           URL publique à contrôler en fin de déploiement
#                       (ex. https://gstock.monetiquetunisie.com).
#   --force-schema      Applique le SQL même s'il contient des instructions
#                       destructrices. À N'UTILISER QU'APRÈS RELECTURE HUMAINE.
#   --yes               Ne pose aucune question (mode non interactif).
#   -h, --help          Affiche cette aide.
#

set -Eeuo pipefail

# ---------------------------------------------------------------------------
# Options et valeurs par défaut
# ---------------------------------------------------------------------------
APP_DIR="$(pwd)"
BRANCH="main"
BACKUP_DIR="${HOME}/sauvegardes-stock"
PM2_NAME=""
APP_PORT=""
URL_PUBLIQUE=""
DRY_RUN=false
FORCE_SCHEMA=false
ASSUME_YES=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)       DRY_RUN=true; shift ;;
        --app-dir)       APP_DIR="$2"; shift 2 ;;
        --branch)        BRANCH="$2"; shift 2 ;;
        --backup-dir)    BACKUP_DIR="$2"; shift 2 ;;
        --pm2-name)      PM2_NAME="$2"; shift 2 ;;
        --port)          APP_PORT="$2"; shift 2 ;;
        --url)           URL_PUBLIQUE="$2"; shift 2 ;;
        --force-schema)  FORCE_SCHEMA=true; shift ;;
        --yes|-y)        ASSUME_YES=true; shift ;;
        -h|--help)       sed -n '2,30p' "$0"; exit 0 ;;
        *) echo "Option inconnue : $1 (voir --help)"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Affichage
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
    VERT=$'\033[0;32m'; JAUNE=$'\033[1;33m'; ROUGE=$'\033[0;31m'
    BLEU=$'\033[0;36m'; GRAS=$'\033[1m'; NEUTRE=$'\033[0m'
else
    VERT=""; JAUNE=""; ROUGE=""; BLEU=""; GRAS=""; NEUTRE=""
fi

ok()      { echo "${VERT}  ✓ $*${NEUTRE}"; }
info()    { echo "    $*"; }
attention(){ echo "${JAUNE}  ⚠ $*${NEUTRE}"; }
erreur()  { echo "${ROUGE}  ✗ $*${NEUTRE}" >&2; }
etape()   { echo; echo "${BLEU}${GRAS}▸ $*${NEUTRE}"; }

# Journal complet du déploiement
HORO="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
JOURNAL="${BACKUP_DIR}/deploiement_${HORO}.log"
exec > >(tee -a "$JOURNAL") 2>&1

echo "=========================================================="
echo " Déploiement sécurisé — gestion-stock-smt-V2"
echo " $(date '+%Y-%m-%d %H:%M:%S')   journal : $JOURNAL"
$DRY_RUN && echo " MODE SIMULATION (--dry-run) : rien ne sera appliqué"
echo "=========================================================="

# ---------------------------------------------------------------------------
# État partagé, utilisé par le rollback
# ---------------------------------------------------------------------------
COMMIT_AVANT=""
DUMP=""
SAUV_UPLOADS=""
SAUV_ENV_DIR=""
CODE_MODIFIE=false
DEPS_MODIFIEES=false
SCHEMA_MODIFIE=false
SCHEMA_APPLIQUE=false
DB_VERIF=""
COMPTAGES_AVANT=""
ROLLBACK_EN_COURS=false
DEPLOIEMENT_REUSSI=false

# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------
rollback() {
    local ligne="${1:-?}"
    $ROLLBACK_EN_COURS && return 0
    ROLLBACK_EN_COURS=true
    set +e

    echo
    echo "${ROUGE}${GRAS}=========================================================="
    echo " ÉCHEC (ligne $ligne) — ROLLBACK EN COURS"
    echo "==========================================================${NEUTRE}"

    cd "$APP_DIR" 2>/dev/null

    if $CODE_MODIFIE && [[ -n "$COMMIT_AVANT" ]]; then
        etape "Restauration du code au commit $COMMIT_AVANT"
        git reset --hard "$COMMIT_AVANT" && ok "Code restauré" || erreur "git reset a échoué"

        # Les fichiers .env* sont suivis par git dans ce dépôt : on remet ceux
        # qui tournaient avant, au cas où le pull les aurait remplacés.
        if [[ -n "$SAUV_ENV_DIR" && -d "$SAUV_ENV_DIR" ]]; then
            for f in "$SAUV_ENV_DIR"/.env*; do
                [[ -e "$f" ]] && cp -p "$f" "$APP_DIR/" && info "restauré : $(basename "$f")"
            done
        fi

        # On ne reconstruit que si les dépendances ou le build avaient été
        # touchés. Sinon l'application n'a jamais cessé de servir l'ancienne
        # version depuis .next : la redémarrer n'apporterait qu'une coupure.
        if $DEPS_MODIFIEES; then
            etape "Reconstruction de l'ancienne version"
            npm ci --no-audit --no-fund || npm install --no-audit --no-fund
            DATABASE_URL="$DB_URL" npx prisma generate
            rm -rf .next
            NODE_ENV=production npm run build && ok "Build restauré" || erreur "Le build de l'ancienne version a échoué"

            etape "Redémarrage de l'application"
            redemarrer_app
        else
            ok "Dépendances et build intacts : l'application n'a subi aucune interruption"
        fi
    else
        info "Le code n'avait pas encore été modifié : rien à restaurer côté application."
    fi

    # La base : on ne restaure JAMAIS automatiquement. Une restauration écraserait
    # les écritures faites depuis le dump. On mesure d'abord, on décide ensuite.
    echo
    etape "État de la base de données"
    if $SCHEMA_APPLIQUE; then
        attention "Le schéma a reçu des ajouts (colonnes/tables) avant l'échec."
        info "Ces ajouts sont sans effet sur l'ancien code : Prisma ne lit que"
        info "les colonnes qu'il connaît. Aucune restauration n'est nécessaire."
    else
        ok "La base n'a pas été modifiée par ce déploiement."
    fi
    comparer_comptages "après rollback" || true

    echo
    echo "${JAUNE}Sauvegardes disponibles :${NEUTRE}"
    [[ -n "$DUMP" ]]          && info "base     : $DUMP"
    [[ -n "$SAUV_UPLOADS" ]]  && info "uploads  : $SAUV_UPLOADS"
    [[ -n "$SAUV_ENV_DIR" ]]  && info "config   : $SAUV_ENV_DIR"
    [[ -n "$DB_VERIF" ]]      && info "copie restaurée et vérifiée : base « $DB_VERIF »"
    echo
    echo "${JAUNE}Restauration complète de la base (DERNIER RECOURS, écrase les"
    echo "écritures postérieures à la sauvegarde) :${NEUTRE}"
    info "sudo -u postgres pg_restore -d ${DB_NAME:-stock_management} --clean --if-exists < \"$DUMP\""
    echo
    echo "Journal complet : $JOURNAL"
    exit 1
}
trap 'rollback "$LINENO"' ERR

nettoyage_final() {
    if $DEPLOIEMENT_REUSSI && [[ -n "$DB_VERIF" ]]; then
        echo
        info "Base de vérification « $DB_VERIF » conservée pour contrôle."
        info "À supprimer une fois la mise à jour validée :"
        info "  sudo -u postgres dropdb $DB_VERIF"
    fi
}
trap nettoyage_final EXIT

demander() {
    # demander "question" -> 0 si oui
    $ASSUME_YES && return 0
    [[ -t 0 ]] || return 1
    local reponse
    read -r -p "    $1 [o/N] " reponse
    [[ "$reponse" =~ ^[oOyY]$ ]]
}

# ---------------------------------------------------------------------------
# ÉTAPE 0 — Vérifications préalables (rien n'est encore modifié)
# ---------------------------------------------------------------------------
etape "0/9  Vérifications préalables"

cd "$APP_DIR"
APP_DIR="$(pwd)"
info "Répertoire : $APP_DIR"

for outil in git npm npx psql pg_dump pg_restore curl; do
    command -v "$outil" >/dev/null 2>&1 || { erreur "Commande introuvable : $outil"; exit 1; }
done
ok "Outils requis présents"

[[ -d .git ]]            || { erreur "$APP_DIR n'est pas un dépôt git"; exit 1; }
[[ -f package.json ]]    || { erreur "package.json introuvable"; exit 1; }
[[ -f prisma/schema.prisma ]] || { erreur "prisma/schema.prisma introuvable"; exit 1; }
ok "Structure du projet reconnue"

# git refuse d'opérer si le propriétaire du répertoire diffère (courant en prod)
git config --global --get-all safe.directory 2>/dev/null | grep -qx "$APP_DIR" \
    || git config --global --add safe.directory "$APP_DIR"

# Modifications locales : `git pull` les écraserait ou refuserait de tourner.
# Les .env* étant suivis par git dans ce dépôt, on ne prend aucun risque.
MODIFS="$(git status --porcelain --untracked-files=no)"
if [[ -n "$MODIFS" ]]; then
    erreur "Des fichiers suivis par git sont modifiés localement :"
    echo "$MODIFS" | sed 's/^/      /'
    echo
    info "Traitez-les avant de déployer (sauvegardez-les puis 'git checkout --' ,"
    info "ou commitez-les). Le script s'arrête ici : rien n'a été modifié."
    exit 1
fi
ok "Aucune modification locale non commitée"

# Espace disque : la sauvegarde + le build en ont besoin
ESPACE_MO=$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')
if (( ESPACE_MO < 2048 )); then
    attention "Espace disque faible : ${ESPACE_MO} Mo libres (2 Go recommandés)"
    demander "Continuer malgré tout ?" || { info "Déploiement annulé."; exit 1; }
else
    ok "Espace disque : ${ESPACE_MO} Mo libres"
fi

# --- URL de la base -------------------------------------------------------
# Next.js charge .env.production en priorité sur .env quand NODE_ENV=production.
# Le CLI Prisma, lui, ne lit que .env : on passe donc DATABASE_URL explicitement
# à chaque commande prisma.
lire_env() {
    local fichier="$1" cle="$2"
    [[ -f "$fichier" ]] || return 1
    sed -n "s/^[[:space:]]*${cle}[[:space:]]*=[[:space:]]*//p" "$fichier" \
        | tail -n1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

DB_URL="${DATABASE_URL:-}"
for fichier in .env.production .env.local .env; do
    [[ -n "$DB_URL" ]] && break
    DB_URL="$(lire_env "$fichier" DATABASE_URL || true)"
    [[ -n "$DB_URL" ]] && info "DATABASE_URL lue dans $fichier"
done
[[ -n "$DB_URL" ]] || { erreur "DATABASE_URL introuvable (.env.production / .env)"; exit 1; }

DB_NAME="$(printf '%s' "$DB_URL" | sed -e 's#.*/##' -e 's#?.*##')"
[[ -n "$DB_NAME" ]] || { erreur "Impossible de déduire le nom de la base depuis DATABASE_URL"; exit 1; }
ok "Base cible : $DB_NAME"

# --- Accès à la base ------------------------------------------------------
# On privilégie les identifiants de l'application ; à défaut on passe par le
# rôle postgres (comme le fait votre deploy.sh actuel).
MODE_PSQL=""
if psql "$DB_URL" -tAc 'select 1' >/dev/null 2>&1; then
    MODE_PSQL="url"
elif sudo -n -u postgres psql -d "$DB_NAME" -tAc 'select 1' >/dev/null 2>&1; then
    MODE_PSQL="postgres"
else
    erreur "Impossible de se connecter à la base « $DB_NAME »"
    info "Testé : psql \"\$DATABASE_URL\" puis sudo -u postgres psql -d $DB_NAME"
    exit 1
fi
ok "Connexion à la base établie (mode : $MODE_PSQL)"

sql() {  # sql "requête"  -> lignes brutes
    if [[ "$MODE_PSQL" == "url" ]]; then
        psql "$DB_URL" -v ON_ERROR_STOP=1 -tA -F'|' -c "$1"
    else
        sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -tA -F'|' -c "$1"
    fi
}

# La table cards a reçu une contrainte d'unicité sur (bankId, name, type,
# subType, subSubType) : si des doublons existent déjà en base, la création
# de cet index unique échoue au moment de « prisma db push » (étape 6). On le
# détecte ici, avant toute modification, pour arrêter proprement avec un
# message actionnable plutôt que de laisser échouer l'étape d'application du
# schéma. Coût négligeable : une fois la contrainte en place, ces doublons
# deviennent structurellement impossibles, donc ce contrôle ne coûte plus
# rien lors des déploiements suivants.
verifier_doublons_cartes() {
    local doublons
    doublons="$(sql "
      SELECT \"bankId\" || ' / ' || name || ' / ' || type || ' / ' || \"subType\" || ' / ' || \"subSubType\"
             || ' : ' || count(*) || ' occurrences'
      FROM cards
      GROUP BY \"bankId\", name, type, \"subType\", \"subSubType\"
      HAVING count(*) > 1;
    " 2>/dev/null || true)"
    if [[ -n "$doublons" ]]; then
        echo
        erreur "Cartes en double détectées (même banque, nom, type, sous-type, sous-sous-type) :"
        printf '%s\n' "$doublons" | sed 's/^/      /'
        echo
        info "La nouvelle contrainte d'unicité sur la table cards échouerait tant que ces"
        info "doublons ne sont pas fusionnés ou renommés. Rien n'a été modifié."
        return 1
    fi
    return 0
}

# --- Process PM2 ----------------------------------------------------------
# L'application tourne sous le nom « gstock ». Le dépôt contient deux autres
# noms hérités : « stock-management » (deploy.sh) et « stock-app »
# (ecosystem.config.js). On teste les trois, puis on prend le process qui tourne.
GESTIONNAIRE="aucun"
if command -v pm2 >/dev/null 2>&1; then
    GESTIONNAIRE="pm2"
    if [[ -z "$PM2_NAME" ]]; then
        for candidat in gstock stock-management stock-app; do
            if pm2 describe "$candidat" >/dev/null 2>&1; then PM2_NAME="$candidat"; break; fi
        done
    fi
    if [[ -z "$PM2_NAME" ]]; then
        # « | head -n1 » fermerait le tuyau et ferait échouer sed (SIGPIPE) :
        # on prend la première ligne avec sed lui-même.
        PM2_NAME="$(pm2 jlist 2>/dev/null | tr ',' '\n' \
                    | sed -n 's/.*"name":"\([^"]*\)".*/\1/p;T;q' || true)"
    fi
    [[ -n "$PM2_NAME" ]] || { erreur "Aucun process PM2 détecté. Précisez --pm2-name."; exit 1; }
    ok "Process PM2 : $PM2_NAME"
elif systemctl list-units --type=service 2>/dev/null | grep -q "stock-management"; then
    GESTIONNAIRE="systemd"
    ok "Service systemd : stock-management"
else
    attention "Ni PM2 ni systemd détecté — le redémarrage devra être fait à la main"
fi

redemarrer_app() {
    case "$GESTIONNAIRE" in
        pm2)
            # Sans --update-env : on met à jour le code, pas la configuration.
            # L'application redémarre avec exactement l'environnement qu'elle avait.
            pm2 restart "$PM2_NAME" && pm2 save --force >/dev/null 2>&1
            ok "Application redémarrée (PM2 : $PM2_NAME)" ;;
        systemd)
            sudo systemctl restart stock-management
            ok "Application redémarrée (systemd)" ;;
        *)
            attention "Redémarrez l'application manuellement" ;;
    esac
}

# --- Port local de l'application ------------------------------------------
# Derrière un reverse proxy (gstock.monetiquetunisie.com), le port local n'est
# pas forcément 3000. On rassemble les candidats de la source la plus fiable à
# la moins fiable, puis on valide chacun par une vraie requête HTTP.
#   1. --port fourni explicitement
#   2. PORT enregistré par PM2 pour ce process (source la plus sûre)
#   3. ports TCP en écoute (ss, puis netstat)
#   4. valeurs usuelles
port_declare_pm2() {
    [[ "$GESTIONNAIRE" == "pm2" ]] || return 0
    pm2 jlist 2>/dev/null | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  try{
    const app=JSON.parse(d).find(a=>a.name===process.argv[1]);
    const e=(app&&app.pm2_env)||{};
    const p=e.PORT||(e.env&&e.env.PORT);
    if(p)console.log(String(p).replace(/[^0-9]/g,""));
  }catch(_){}
});' "$PM2_NAME" 2>/dev/null || true
}

ports_en_ecoute() {
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | awk 'NR>1 {print $4}' | sed 's/.*://' | sort -un
    elif command -v netstat >/dev/null 2>&1; then
        netstat -ltn 2>/dev/null | awk '/^tcp/ {print $4}' | sed 's/.*://' | sort -un
    fi
    return 0
}

detecter_port() {
    local candidats=() p
    [[ -n "$APP_PORT" ]] && candidats+=("$APP_PORT")
    while read -r p; do [[ -n "$p" ]] && candidats+=("$p"); done < <(port_declare_pm2)
    while read -r p; do
        # On ignore les ports systeme : on cherche un serveur applicatif.
        [[ -n "$p" ]] && (( p >= 1024 )) && candidats+=("$p")
    done < <(ports_en_ecoute)
    candidats+=(3000 3001 3002 8080 8000)
    for p in "${candidats[@]}"; do
        if curl -sf -o /dev/null --max-time 5 "http://localhost:$p/" 2>/dev/null; then
            printf '%s' "$p"; return 0
        fi
    done
    return 1
}

# --- Comptages de référence ----------------------------------------------
# Comptages EXACTS de toutes les tables (pas d'estimation type n_live_tup).
comptages() {
    sql "
      SELECT table_name || '=' ||
             (xpath('/row/c/text()',
                    query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                                 false, true, '')))[1]::text
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    " | sed '/^$/d'
}

comparer_comptages() {
    local libelle="$1" apres ligne table avant maintenant regression=false
    apres="$(comptages)"
    echo "    Table                     avant      $libelle"
    while IFS= read -r ligne; do
        table="${ligne%%=*}"; avant="${ligne##*=}"
        maintenant="$(printf '%s\n' "$apres" | sed -n "s/^${table}=//p")"
        [[ -z "$maintenant" ]] && maintenant="ABSENTE"
        if [[ "$maintenant" == "ABSENTE" ]] || (( maintenant < avant )) 2>/dev/null; then
            printf "${ROUGE}    %-22s %8s   %10s  ← PERTE${NEUTRE}\n" "$table" "$avant" "$maintenant"
            regression=true
        else
            printf "    %-22s %8s   %10s\n" "$table" "$avant" "$maintenant"
        fi
    done <<< "$COMPTAGES_AVANT"
    # Tables nouvellement créées
    while IFS= read -r ligne; do
        table="${ligne%%=*}"
        printf '%s\n' "$COMPTAGES_AVANT" | grep -q "^${table}=" || \
            printf "${VERT}    %-22s %8s   %10s  ← nouvelle${NEUTRE}\n" "$table" "-" "${ligne##*=}"
    done <<< "$apres"
    $regression && return 1
    return 0
}

COMPTAGES_AVANT="$(comptages)"
NB_TABLES=$(printf '%s\n' "$COMPTAGES_AVANT" | wc -l)
ok "Comptages de référence relevés sur $NB_TABLES tables"
printf '%s\n' "$COMPTAGES_AVANT" | sed 's/^/      /'

COMMIT_AVANT="$(git rev-parse HEAD)"
ok "Commit actuel : $(git log --oneline -1)"

# ---------------------------------------------------------------------------
# ÉTAPE 1 — Sauvegarde
# ---------------------------------------------------------------------------
etape "1/9  Sauvegarde de la base, des fichiers téléversés et de la configuration"

DUMP="${BACKUP_DIR}/${DB_NAME}_${HORO}.dump"
if [[ "$MODE_PSQL" == "url" ]]; then
    pg_dump -Fc --no-owner --no-acl -d "$DB_URL" -f "$DUMP"
else
    sudo -u postgres pg_dump -Fc --no-owner --no-acl "$DB_NAME" > "$DUMP"
fi
[[ -s "$DUMP" ]] || { erreur "La sauvegarde est vide"; exit 1; }
ok "Base sauvegardée : $DUMP ($(du -h "$DUMP" | cut -f1))"

# public/uploads/ est dans .gitignore : justificatifs et avatars n'existent
# QUE sur ce serveur. Aucun git ne les restaurera.
if [[ -d public/uploads ]]; then
    SAUV_UPLOADS="${BACKUP_DIR}/uploads_${HORO}.tgz"
    tar czf "$SAUV_UPLOADS" public/uploads
    ok "Fichiers téléversés : $SAUV_UPLOADS ($(du -h "$SAUV_UPLOADS" | cut -f1))"
else
    info "public/uploads/ absent — rien à sauvegarder de ce côté"
fi

SAUV_ENV_DIR="${BACKUP_DIR}/config_${HORO}"
mkdir -p "$SAUV_ENV_DIR"
for f in .env .env.production .env.local; do
    [[ -f "$f" ]] && cp -p "$f" "$SAUV_ENV_DIR/"
done
chmod -R go-rwx "$SAUV_ENV_DIR"
ok "Configuration sauvegardée : $SAUV_ENV_DIR"

# ---------------------------------------------------------------------------
# ÉTAPE 2 — Vérification de la sauvegarde par restauration réelle
# ---------------------------------------------------------------------------
etape "2/9  Vérification de la sauvegarde (restauration dans une base jetable)"

pg_restore -l "$DUMP" >/dev/null
ok "Archive lisible et complète (table des matières valide)"

if sudo -n -u postgres psql -tAc 'select 1' >/dev/null 2>&1; then
    DB_VERIF="verif_${DB_NAME}_${HORO}"
    LOG_RESTAURE="${BACKUP_DIR}/restauration_verif_${HORO}.log"
    sudo -u postgres dropdb --if-exists "$DB_VERIF" >/dev/null 2>&1
    sudo -u postgres createdb "$DB_VERIF"

    # Le fichier est lu par l'utilisateur courant et transmis sur l'entrée
    # standard : l'utilisateur « postgres » n'a pas besoin d'accéder au
    # répertoire de sauvegarde (souvent /root/..., illisible pour lui).
    # pg_restore renvoie un code non nul au moindre avertissement : le verdict
    # réel, c'est la comparaison des comptages juste après.
    sudo -u postgres pg_restore -d "$DB_VERIF" --no-owner --no-acl \
        < "$DUMP" > "$LOG_RESTAURE" 2>&1 || true

    COMPTAGES_COPIE="$(sudo -u postgres psql -d "$DB_VERIF" -tA -F'|' -c "
      SELECT table_name || '=' ||
             (xpath('/row/c/text()',
                    query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                                 false, true, '')))[1]::text
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;" | sed '/^$/d')"

    if [[ "$COMPTAGES_COPIE" == "$COMPTAGES_AVANT" ]]; then
        ok "Restauration vérifiée : la copie contient exactement les mêmes lignes"
        info "Base de contrôle conservée : $DB_VERIF"
    else
        erreur "La sauvegarde restaurée NE correspond PAS à la production :"
        diff <(printf '%s\n' "$COMPTAGES_AVANT") <(printf '%s\n' "$COMPTAGES_COPIE") | sed 's/^/      /' || true
        echo
        info "Sortie de pg_restore ($LOG_RESTAURE) :"
        head -20 "$LOG_RESTAURE" | sed 's/^/      /'
        erreur "Déploiement refusé : la sauvegarde n'est pas fiable."
        exit 1
    fi
else
    attention "sudo -u postgres indisponible : restauration de contrôle non effectuée."
    attention "Seule la validité de l'archive a pu être vérifiée."
    demander "Continuer sans test de restauration ?" || { info "Déploiement annulé."; exit 1; }
fi

# ---------------------------------------------------------------------------
# ÉTAPE 3 — Récupération du code
# ---------------------------------------------------------------------------
etape "3/9  Récupération du code depuis origin/$BRANCH"

git fetch origin "$BRANCH"
CIBLE="$(git rev-parse "origin/$BRANCH")"

if [[ "$CIBLE" == "$COMMIT_AVANT" ]]; then
    ok "Déjà à jour ($(git log --oneline -1)) — aucune modification de code"
else
    # -n 20 plutôt qu'un « | head -20 » : head fermerait le tuyau et ferait
    # échouer git (SIGPIPE), ce qui déclencherait un rollback pour rien.
    info "$(git rev-list --count "$COMMIT_AVANT".."$CIBLE") commit(s) à appliquer, les 20 derniers :"
    git log --oneline -n 20 "$COMMIT_AVANT".."$CIBLE" | sed 's/^/      /'

    if $DRY_RUN; then
        attention "SIMULATION : le pull n'est pas effectué"
    else
        git merge --ff-only "origin/$BRANCH"
        CODE_MODIFIE=true
        ok "Code mis à jour : $(git log --oneline -1)"
    fi
fi

# L'application tourne toujours sur l'ancien build (.next n'a pas été touché).

# ---------------------------------------------------------------------------
# ÉTAPE 4 — Analyse du delta de schéma, EN LECTURE SEULE
# ---------------------------------------------------------------------------
etape "4/9  Analyse des modifications de schéma (lecture seule)"

SQL_DELTA="${BACKUP_DIR}/delta_schema_${HORO}.sql"

# En simulation le pull n'a pas eu lieu : prisma/schema.prisma sur le disque est
# encore l'ANCIEN. Comparer la base à ce fichier conclurait « rien à migrer »,
# ce qui serait faux. On lit donc le schéma cible directement dans origin/BRANCHE.
SCHEMA_CIBLE="prisma/schema.prisma"
if $DRY_RUN && [[ "$CIBLE" != "$COMMIT_AVANT" ]]; then
    SCHEMA_CIBLE="${BACKUP_DIR}/schema_cible_${HORO}.prisma"
    git show "origin/${BRANCH}:prisma/schema.prisma" > "$SCHEMA_CIBLE"
    info "Schéma cible lu dans origin/$BRANCH (le pull n'a pas été effectué)"
fi

DATABASE_URL="$DB_URL" npx --yes prisma migrate diff \
    --from-url "$DB_URL" \
    --to-schema-datamodel "$SCHEMA_CIBLE" \
    --script > "$SQL_DELTA" 2>/dev/null

if grep -qi 'empty migration' "$SQL_DELTA"; then
    ok "La base est déjà conforme au schéma — aucune migration nécessaire"
else
    info "SQL qui serait appliqué (également enregistré dans $SQL_DELTA) :"
    sed 's/^/      /' "$SQL_DELTA"
    SCHEMA_MODIFIE=true

    # Détection des instructions pouvant détruire des données.
    DESTRUCTIF="$(grep -inE 'DROP[[:space:]]+(TABLE|COLUMN|SCHEMA|DATABASE|CONSTRAINT)|TRUNCATE|DELETE[[:space:]]+FROM|ALTER[[:space:]]+COLUMN.*(TYPE|SET[[:space:]]+NOT[[:space:]]+NULL)|SET[[:space:]]+NOT[[:space:]]+NULL' "$SQL_DELTA" || true)"
    if [[ -n "$DESTRUCTIF" ]]; then
        echo
        erreur "INSTRUCTIONS DESTRUCTRICES DÉTECTÉES :"
        printf '%s\n' "$DESTRUCTIF" | sed 's/^/      /'
        echo
        if $FORCE_SCHEMA; then
            attention "--force-schema actif : application malgré tout (sous votre responsabilité)"
        else
            erreur "Déploiement interrompu avant toute modification de la base."
            info "Faites relire $SQL_DELTA, puis relancez avec --force-schema si validé."
            rollback "$LINENO"
        fi
    else
        ok "Delta purement additif : aucune instruction destructrice"
    fi

    # Vérification indépendante des instructions détectées ci-dessus : porte
    # spécifiquement sur les données actuelles, pas sur le texte du SQL généré.
    if verifier_doublons_cartes; then
        ok "Aucun doublon de carte ne bloquerait la nouvelle contrainte d'unicité"
    else
        erreur "Déploiement interrompu avant toute modification de la base."
        rollback "$LINENO"
    fi
fi

if $DRY_RUN; then
    echo
    echo "${VERT}${GRAS}=========================================================="
    echo " SIMULATION TERMINÉE — rien n'a été modifié"
    echo "==========================================================${NEUTRE}"
    info "Sauvegarde vérifiée : $DUMP"
    [[ -f "$SQL_DELTA" ]] && info "SQL prévu           : $SQL_DELTA"
    info "Journal             : $JOURNAL"
    DEPLOIEMENT_REUSSI=true
    trap - ERR
    exit 0
fi

# ---------------------------------------------------------------------------
# ÉTAPE 5 — Dépendances et client Prisma
# ---------------------------------------------------------------------------
etape "5/9  Installation des dépendances"

DEPS_MODIFIEES=true   # à partir d'ici, un rollback devra reconstruire
if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
else
    npm install --no-audit --no-fund
fi
ok "Dépendances installées"

DATABASE_URL="$DB_URL" npx prisma generate
ok "Client Prisma généré"

# ---------------------------------------------------------------------------
# ÉTAPE 6 — Application du schéma
# ---------------------------------------------------------------------------
etape "6/9  Mise à jour du schéma de la base"

if ! $SCHEMA_MODIFIE; then
    ok "Rien à appliquer"
else
    # Volontairement SANS --accept-data-loss : Prisma refusera plutôt que de
    # détruire quoi que ce soit. Et surtout : jamais de migrate reset / seed.
    SORTIE_PUSH="${BACKUP_DIR}/prisma_push_${HORO}.log"
    if DATABASE_URL="$DB_URL" npx prisma db push --skip-generate 2>&1 | tee "$SORTIE_PUSH"; then
        SCHEMA_APPLIQUE=true
        ok "Schéma synchronisé"
    else
        erreur "prisma db push a échoué — voir $SORTIE_PUSH"
        rollback "$LINENO"
    fi

    if grep -qi 'accept-data-loss\|data loss' "$SORTIE_PUSH"; then
        erreur "Prisma signale un risque de perte de données. Rien n'a été forcé."
        rollback "$LINENO"
    fi

    etape "Contrôle des données après migration"
    comparer_comptages "après migration" || {
        erreur "Régression détectée sur au moins une table."
        rollback "$LINENO"
    }
    ok "Aucune ligne perdue"
fi

# ---------------------------------------------------------------------------
# ÉTAPE 7 — Build
# ---------------------------------------------------------------------------
etape "7/9  Construction de l'application"

rm -rf .next node_modules/.cache
NODE_ENV=production npm run build
[[ -d .next ]] || { erreur "Le build n'a produit aucun répertoire .next"; rollback "$LINENO"; }
ok "Build terminé"

# ---------------------------------------------------------------------------
# ÉTAPE 8 — Redémarrage
# ---------------------------------------------------------------------------
etape "8/9  Redémarrage du service"

redemarrer_app
info "Attente du démarrage..."
sleep 8

# ---------------------------------------------------------------------------
# ÉTAPE 9 — Contrôles post-déploiement
# ---------------------------------------------------------------------------
etape "9/9  Contrôles post-déploiement"

# 1) L'application répond, sur le port qu'elle écoute réellement
PORT_DETECTE=""
for essai in 1 2 3 4 5 6; do
    PORT_DETECTE="$(detecter_port || true)"
    [[ -n "$PORT_DETECTE" ]] && break
    info "tentative $essai/6..."
    sleep 5
done
if [[ -z "$PORT_DETECTE" ]]; then
    erreur "Application injoignable en local après 6 essais"
    info "Si elle écoute sur un port inhabituel, relancez avec --port <PORT>."
    [[ "$GESTIONNAIRE" == "pm2" ]] && pm2 logs "$PM2_NAME" --lines 30 --nostream || true
    rollback "$LINENO"
fi
BASE_URL="http://localhost:${PORT_DETECTE}"
ok "Application accessible sur $BASE_URL"


# 2) Prisma sait lire la table users avec les nouvelles colonnes.
#    C'est LE contrôle qui détecte une migration manquante : sans les colonnes
#    avatarUrl / twoFactorEnabled / ..., cette route renvoie 500 au lieu de 401.
#    On utilise une adresse inexistante pour ne verrouiller aucun compte réel.
CODE_HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
    -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"controle-deploiement-inexistant@invalid.local","password":"x"}' || echo 000)"
case "$CODE_HTTP" in
    401|400|429)
        ok "Accès base via l'API validé (HTTP $CODE_HTTP — rejet attendu, pas d'erreur serveur)" ;;
    500|502|503)
        erreur "L'API renvoie HTTP $CODE_HTTP : la couche base de données est cassée"
        [[ "$GESTIONNAIRE" == "pm2" ]] && pm2 logs "$PM2_NAME" --lines 30 --nostream || true
        rollback "$LINENO" ;;
    *)
        attention "Réponse inattendue de /api/auth/login : HTTP $CODE_HTTP" ;;
esac

# 3) URL publique (reverse proxy). Informatif : un echec ici vient du proxy
#    ou du DNS, pas du deploiement, donc on n'annule pas pour autant.
if [[ -n "$URL_PUBLIQUE" ]]; then
    # Le « || echo 000 » concatenerait sa sortie a celle de curl (d'ou un
    # "000000" illisible) : on capture, puis on normalise.
    CODE_PUB="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -L "$URL_PUBLIQUE" 2>/dev/null || true)"
    [[ "$CODE_PUB" =~ ^[0-9]{3}$ ]] || CODE_PUB="000"
    if [[ "$CODE_PUB" == "200" ]]; then
        ok "URL publique accessible : $URL_PUBLIQUE (HTTP 200)"
    else
        attention "URL publique $URL_PUBLIQUE : HTTP $CODE_PUB"
        info "L'application répond en local : vérifiez le reverse proxy (nginx) et le DNS."
    fi
fi

# 4) Comptages finaux
etape "Comptages finaux"
comparer_comptages "après déploiement" || {
    erreur "Des lignes ont disparu pendant le déploiement."
    rollback "$LINENO"
}
ok "Toutes les données sont intactes"

# 5) Fichiers téléversés toujours en place
if [[ -n "$SAUV_UPLOADS" ]]; then
    NB=$(find public/uploads -type f 2>/dev/null | wc -l || true)
    ok "public/uploads/ : $NB fichier(s) présent(s)"
fi

# ---------------------------------------------------------------------------
DEPLOIEMENT_REUSSI=true
trap - ERR

echo
echo "${VERT}${GRAS}=========================================================="
echo " DÉPLOIEMENT RÉUSSI"
echo "==========================================================${NEUTRE}"
info "Commit précédent : $(git log --oneline -1 "$COMMIT_AVANT")"
info "Commit déployé   : $(git log --oneline -1)"
info "Sauvegarde base  : $DUMP"
[[ -n "$SAUV_UPLOADS" ]] && info "Sauvegarde fichiers : $SAUV_UPLOADS"
info "Configuration    : $SAUV_ENV_DIR"
info "Journal          : $JOURNAL"
echo
echo "Retour arrière manuel si nécessaire :"
info "cd $APP_DIR && git reset --hard $COMMIT_AVANT"
info "npm ci && npx prisma generate && rm -rf .next && NODE_ENV=production npm run build"
[[ "$GESTIONNAIRE" == "pm2" ]] && info "pm2 restart $PM2_NAME"
echo

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Début du seeding de la base de données...')

  // Nettoyage des données existantes
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.stockLevel.deleteMany()
  await prisma.movement.deleteMany()
  await prisma.card.deleteMany()
  await prisma.location.deleteMany()
  await prisma.bank.deleteMany()
  await prisma.user.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.appConfig.deleteMany()

  console.log('✅ Nettoyage terminé')

  // Création des rôles avec permissions
  const adminRole = await prisma.rolePermission.create({
    data: {
      role: 'admin',
      description: 'Administrateur avec tous les droits',
      isCustom: false,
      permissions: [
        'banks:create', 'banks:read', 'banks:update', 'banks:delete',
        'cards:create', 'cards:read', 'cards:update', 'cards:delete',
        'locations:create', 'locations:read', 'locations:update', 'locations:delete',
        'movements:create', 'movements:read', 'movements:update', 'movements:delete',
        'users:create', 'users:read', 'users:update', 'users:delete',
        'reports:read',
        'dashboard:read',
        'config:read', 'config:update',
        'logs:read'
      ]
    }
  })

  const managerRole = await prisma.rolePermission.create({
    data: {
      role: 'manager',
      description: 'Gestionnaire avec droits de gestion',
      isCustom: false,
      permissions: [
        'banks:read',
        'cards:create', 'cards:read', 'cards:update',
        'locations:read',
        'movements:create', 'movements:read',
        'users:read',
        'reports:read',
        'dashboard:read'
      ]
    }
  })

  const userRole = await prisma.rolePermission.create({
    data: {
      role: 'user',
      description: 'Utilisateur avec droits de lecture',
      isCustom: false,
      permissions: [
        'banks:read',
        'cards:read',
        'locations:read',
        'movements:read',
        'dashboard:read'
      ]
    }
  })

  console.log('✅ Rôles créés')

  // Création des utilisateurs
  const hashedPassword = await bcrypt.hash('password123', 10)

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@monetique.tn',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'System',
      role: 'admin',
      isActive: true
    }
  })

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@monetique.tn',
      password: hashedPassword,
      firstName: 'Mohamed',
      lastName: 'Manager',
      role: 'manager',
      isActive: true
    }
  })

  const normalUser = await prisma.user.create({
    data: {
      email: 'user@monetique.tn',
      password: hashedPassword,
      firstName: 'Ahmed',
      lastName: 'User',
      role: 'user',
      isActive: true
    }
  })

  console.log('✅ Utilisateurs créés')

  // Création des banques
  const banks = await Promise.all([
    prisma.bank.create({
      data: {
        name: 'Banque Centrale de Tunisie',
        code: 'BCT001',
        address: 'Avenue Mohamed V, Tunis',
        phone: '+216 71 340 588',
        email: 'contact@bct.gov.tn',
        country: 'Tunisie',
        swiftCode: 'BCTUTNTX',
        isActive: true
      }
    }),
    prisma.bank.create({
      data: {
        name: 'Banque de Tunisie',
        code: 'BT002',
        address: 'Rue Hédi Nouira, Tunis',
        phone: '+216 71 831 000',
        email: 'contact@bt.com.tn',
        country: 'Tunisie',
        swiftCode: 'BKTUTNTX',
        isActive: true
      }
    }),
    prisma.bank.create({
      data: {
        name: 'Banque Internationale Arabe de Tunisie',
        code: 'BIAT003',
        address: 'Rue Hédi Karray, Tunis',
        phone: '+216 71 960 000',
        email: 'contact@biat.com.tn',
        country: 'Tunisie',
        swiftCode: 'BIATTNTT',
        isActive: true
      }
    }),
    prisma.bank.create({
      data: {
        name: 'Amen Bank',
        code: 'AB004',
        address: 'Avenue Mohamed V, Tunis',
        phone: '+216 71 835 500',
        email: 'contact@amenbank.com.tn',
        country: 'Tunisie',
        swiftCode: 'CFCTTNTT',
        isActive: true
      }
    })
  ])

  console.log('✅ Banques créées')

  // Création des emplacements
  const locations = await Promise.all([
    prisma.location.create({
      data: {
        name: 'Entrepôt Principal - Tunis',
        description: 'Entrepôt central de stockage',
        bankId: banks[0].id,
        isActive: true
      }
    }),
    prisma.location.create({
      data: {
        name: 'Agence Centre Ville',
        description: 'Agence du centre ville de Tunis',
        bankId: banks[1].id,
        isActive: true
      }
    }),
    prisma.location.create({
      data: {
        name: 'Agence Lafayette',
        description: 'Agence Lafayette',
        bankId: banks[2].id,
        isActive: true
      }
    }),
    prisma.location.create({
      data: {
        name: 'Agence Menzah',
        description: 'Agence Menzah',
        bankId: banks[3].id,
        isActive: true
      }
    })
  ])

  console.log('✅ Emplacements créés')

  // Création des cartes
  const cards = await Promise.all([
    prisma.card.create({
      data: {
        name: 'Carte Visa Classic',
        type: 'Carte de débit',
        subType: 'Visa',
        subSubType: 'National',
        bankId: banks[0].id,
        quantity: 500,
        minThreshold: 100,
        maxThreshold: 1000,
        isActive: true
      }
    }),
    prisma.card.create({
      data: {
        name: 'Carte Mastercard Gold',
        type: 'Carte de crédit',
        subType: 'Mastercard',
        subSubType: 'International',
        bankId: banks[1].id,
        quantity: 300,
        minThreshold: 50,
        maxThreshold: 500,
        isActive: true
      }
    }),
    prisma.card.create({
      data: {
        name: 'Carte Visa Platinum',
        type: 'Carte de crédit',
        subType: 'Visa',
        subSubType: 'International',
        bankId: banks[2].id,
        quantity: 200,
        minThreshold: 30,
        maxThreshold: 300,
        isActive: true
      }
    }),
    prisma.card.create({
      data: {
        name: 'Carte Mastercard Standard',
        type: 'Carte de débit',
        subType: 'Mastercard',
        subSubType: 'National',
        bankId: banks[3].id,
        quantity: 150,
        minThreshold: 50,
        maxThreshold: 500,
        isActive: true
      }
    })
  ])

  console.log('✅ Cartes créées')

  // Création des niveaux de stock
  await Promise.all([
    prisma.stockLevel.create({
      data: {
        cardId: cards[0].id,
        locationId: locations[0].id,
        quantity: 250
      }
    }),
    prisma.stockLevel.create({
      data: {
        cardId: cards[1].id,
        locationId: locations[1].id,
        quantity: 150
      }
    }),
    prisma.stockLevel.create({
      data: {
        cardId: cards[2].id,
        locationId: locations[2].id,
        quantity: 100
      }
    }),
    prisma.stockLevel.create({
      data: {
        cardId: cards[3].id,
        locationId: locations[3].id,
        quantity: 75
      }
    })
  ])

  console.log('✅ Niveaux de stock créés')

  // Création des mouvements
  await Promise.all([
    prisma.movement.create({
      data: {
        cardId: cards[0].id,
        toLocationId: locations[0].id,
        movementType: 'entry',
        quantity: 250,
        reason: 'Stock initial',
        userId: adminUser.id
      }
    }),
    prisma.movement.create({
      data: {
        cardId: cards[1].id,
        toLocationId: locations[1].id,
        movementType: 'entry',
        quantity: 150,
        reason: 'Stock initial',
        userId: adminUser.id
      }
    }),
    prisma.movement.create({
      data: {
        cardId: cards[0].id,
        fromLocationId: locations[0].id,
        toLocationId: locations[1].id,
        movementType: 'transfer',
        quantity: 50,
        reason: 'Transfert inter-agences',
        userId: managerUser.id
      }
    })
  ])

  console.log('✅ Mouvements créés')

  // Création des notifications
  await Promise.all([
    prisma.notification.create({
      data: {
        type: 'warning',
        title: 'Stock faible',
        message: 'Le stock de cartes Mastercard Standard est faible',
        userId: adminUser.id,
        isRead: false
      }
    }),
    prisma.notification.create({
      data: {
        type: 'info',
        title: 'Nouveau mouvement',
        message: 'Un transfert de 50 cartes a été effectué',
        userId: managerUser.id,
        isRead: false
      }
    })
  ])

  console.log('✅ Notifications créées')

  // Création de la configuration de l'application
  await prisma.appConfig.create({
    data: {
      id: 'singleton',
      config: {
        general: {
          companyName: 'Monetique Tunisie',
          logo: '/images/monetique-logo.png',
          language: 'fr',
          currency: 'TND',
          timezone: 'Africa/Tunis'
        },
        smtp: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          username: '',
          password: '',
          fromEmail: 'noreply@monetique.tn',
          fromName: 'Monetique Tunisie'
        },
        notifications: {
          enabled: true,
          lowStockAlerts: true,
          movementNotifications: true,
          userActivityAlerts: true,
          lowStockThreshold: 100,
          criticalStockThreshold: 50,
          emailNotifications: true,
          inAppNotifications: true,
          emailRecipients: ['admin@monetique.tn']
        },
        display: {
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
          numberFormat: 'fr-TN',
          itemsPerPage: 10,
          theme: 'auto'
        },
        security: {
          sessionDuration: 480,
          requireStrongPassword: true,
          minPasswordLength: 8,
          twoFactor: {
            enabled: false,
            appName: 'Monetique Tunisie',
            issuer: 'Monetique',
            codeLength: 6,
            codePeriod: 30,
            algorithm: 'SHA1',
            mandatory: false,
            mandatoryRoles: ['admin'],
            gracePeriodDays: 7
          },
          maxLoginAttempts: 5,
          lockoutDuration: 30
        }
      }
    }
  })

  console.log('✅ Configuration de l\'application créée')

  console.log('🎉 Seeding terminé avec succès!')
  console.log('\n📝 Comptes de test créés:')
  console.log('   Admin: admin@monetique.tn / password123')
  console.log('   Manager: manager@monetique.tn / password123')
  console.log('   User: user@monetique.tn / password123')
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

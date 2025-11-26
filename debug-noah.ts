import { prisma } from './lib/prisma';

async function debugNoah() {
  console.log('=== Checking Noah\'s Account ===\n');

  // Find Noah's user account by email
  const noahUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'noah', mode: 'insensitive' } },
        { name: { contains: 'Noah', mode: 'insensitive' } }
      ]
    },
    include: {
      guide: true
    }
  });

  console.log('Noah User Account:', JSON.stringify(noahUser, null, 2));

  // Find Noah as a guide
  const noahGuide = await prisma.guide.findFirst({
    where: {
      name: { contains: 'Noah', mode: 'insensitive' }
    },
    include: {
      user: true
    }
  });

  console.log('\nNoah Guide Profile:', JSON.stringify(noahGuide, null, 2));

  // Find trips where Noah is trip leader
  if (noahGuide) {
    const tripsAsLeader = await prisma.trip.findMany({
      where: {
        tripLeaderId: noahGuide.id
      },
      include: {
        guides: {
          include: {
            guide: true
          }
        }
      },
      orderBy: {
        tripDate: 'desc'
      },
      take: 5
    });

    console.log('\nTrips where Noah is Trip Leader:', tripsAsLeader.length);
    tripsAsLeader.forEach((trip, i) => {
      console.log(`\nTrip ${i + 1}:`, {
        id: trip.id,
        date: trip.tripDate,
        leadName: trip.leadName,
        createdById: trip.createdById,
        status: trip.status
      });
    });
  }

  // Find trips created by Noah's user account
  if (noahUser) {
    const tripsCreated = await prisma.trip.findMany({
      where: {
        createdById: noahUser.id
      },
      orderBy: {
        tripDate: 'desc'
      },
      take: 5
    });

    console.log('\n\nTrips created by Noah\'s user account:', tripsCreated.length);
    tripsCreated.forEach((trip, i) => {
      console.log(`\nTrip ${i + 1}:`, {
        id: trip.id,
        date: trip.tripDate,
        leadName: trip.leadName,
        tripLeaderId: trip.tripLeaderId,
        status: trip.status
      });
    });
  }

  // Check if user and guide are linked
  console.log('\n=== Linking Status ===');
  console.log('User guideId:', noahUser?.guideId);
  console.log('Guide id:', noahGuide?.id);
  console.log('Are they linked?', noahUser?.guideId === noahGuide?.id);

  await prisma.$disconnect();
}

debugNoah().catch(console.error);

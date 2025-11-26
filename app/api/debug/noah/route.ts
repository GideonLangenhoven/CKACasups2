import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
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

    // Find Noah as a guide
    const noahGuide = await prisma.guide.findFirst({
      where: {
        name: { contains: 'Noah', mode: 'insensitive' }
      },
      include: {
        user: true
      }
    });

    // Find trips where Noah is trip leader
    let tripsAsLeader = [];
    if (noahGuide) {
      tripsAsLeader = await prisma.trip.findMany({
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
        }
      });
    }

    // Find trips created by Noah's user account
    let tripsCreated = [];
    if (noahUser) {
      tripsCreated = await prisma.trip.findMany({
        where: {
          createdById: noahUser.id
        },
        orderBy: {
          tripDate: 'desc'
        }
      });
    }

    return NextResponse.json({
      noahUser: {
        id: noahUser?.id,
        email: noahUser?.email,
        name: noahUser?.name,
        guideId: noahUser?.guideId,
        guide: noahUser?.guide
      },
      noahGuide: {
        id: noahGuide?.id,
        name: noahGuide?.name,
        email: noahGuide?.email,
        rank: noahGuide?.rank,
        hasUser: !!noahGuide?.user
      },
      linked: noahUser?.guideId === noahGuide?.id,
      tripsAsLeader: tripsAsLeader.length,
      tripsCreated: tripsCreated.length,
      recentTripsAsLeader: tripsAsLeader.slice(0, 3).map(t => ({
        id: t.id,
        date: t.tripDate,
        leadName: t.leadName,
        createdById: t.createdById,
        status: t.status
      })),
      recentTripsCreated: tripsCreated.slice(0, 3).map(t => ({
        id: t.id,
        date: t.tripDate,
        leadName: t.leadName,
        tripLeaderId: t.tripLeaderId,
        status: t.status
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Find all Noah profiles
    const noahGuides = await prisma.guide.findMany({
      where: {
        name: { contains: 'Noah', mode: 'insensitive' }
      },
      include: {
        user: true,
        tripGuides: {
          include: {
            trip: true
          }
        },
        ledTrips: true
      }
    });

    // Find all Noah user accounts
    const noahUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'noah', mode: 'insensitive' } },
          { name: { contains: 'Noah', mode: 'insensitive' } }
        ]
      },
      include: {
        guide: true,
        trips: true
      }
    });

    return NextResponse.json({
      guides: noahGuides.map(g => ({
        id: g.id,
        name: g.name,
        email: g.email,
        rank: g.rank,
        active: g.active,
        hasUser: !!g.user,
        tripCount: g.tripGuides.length,
        ledTripCount: g.ledTrips.length
      })),
      users: noahUsers.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        guideId: u.guideId,
        hasGuide: !!u.guide,
        createdTripCount: u.trips.length
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { action, guideIdToDelete, keepGuideId } = await req.json();

    if (action === 'delete_guide') {
      // Delete the incorrect guide profile
      const guideToDelete = await prisma.guide.findUnique({
        where: { id: guideIdToDelete },
        include: {
          user: true,
          tripGuides: true,
          ledTrips: true
        }
      });

      if (!guideToDelete) {
        return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
      }

      // Check if this guide has any trips - if so, we need to be careful
      if (guideToDelete.tripGuides.length > 0 || guideToDelete.ledTrips.length > 0) {
        return NextResponse.json({
          error: 'This guide has trips associated. Cannot delete without reassigning trips first.'
        }, { status: 400 });
      }

      // Unlink user if linked
      if (guideToDelete.user) {
        await prisma.user.update({
          where: { id: guideToDelete.user.id },
          data: { guideId: null }
        });
      }

      // Delete the guide
      await prisma.guide.delete({
        where: { id: guideIdToDelete }
      });

      return NextResponse.json({
        success: true,
        message: `Deleted guide ${guideToDelete.name}`
      });
    }

    if (action === 'link_user_to_guide') {
      const { primaryUserEmail } = await req.json();

      if (!primaryUserEmail) {
        return NextResponse.json({ error: 'primaryUserEmail is required' }, { status: 400 });
      }

      const keepGuide = await prisma.guide.findUnique({
        where: { id: keepGuideId },
        include: { user: true }
      });

      if (!keepGuide) {
        return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
      }

      // Find the primary user (the one Noah is actually using)
      const primaryUser = await prisma.user.findUnique({
        where: { email: primaryUserEmail }
      });

      if (!primaryUser) {
        return NextResponse.json({ error: 'Primary user not found' }, { status: 404 });
      }

      // Step 1: Unlink any existing user from this guide (due to unique constraint)
      if (keepGuide.user) {
        await prisma.user.update({
          where: { id: keepGuide.user.id },
          data: { guideId: null }
        });
      }

      // Step 2: Link the primary user to the guide
      await prisma.user.update({
        where: { id: primaryUser.id },
        data: {
          guideId: keepGuideId,
          name: keepGuide.name  // Sync name to match guide
        }
      });

      // Step 3: Update guide email to match primary user
      await prisma.guide.update({
        where: { id: keepGuideId },
        data: { email: primaryUserEmail }
      });

      return NextResponse.json({
        success: true,
        message: `Successfully linked ${primaryUserEmail} to guide ${keepGuide.name}`,
        unlinkedOldUser: keepGuide.user ? keepGuide.user.email : null
      });
    }

    if (action === 'rename_guide') {
      const { guideId, newName } = await req.json();

      if (!guideId || !newName) {
        return NextResponse.json({ error: 'guideId and newName are required' }, { status: 400 });
      }

      const guide = await prisma.guide.update({
        where: { id: guideId },
        data: { name: newName.trim() }
      });

      // Also update any linked user's name
      if (guide) {
        const linkedUser = await prisma.user.findFirst({
          where: { guideId: guideId }
        });

        if (linkedUser) {
          await prisma.user.update({
            where: { id: linkedUser.id },
            data: { name: newName.trim() }
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Guide renamed to "${newName.trim()}"`
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

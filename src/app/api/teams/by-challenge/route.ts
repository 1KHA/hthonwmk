import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// GET /api/teams/by-challenge
// Fetches all approved teams grouped by their challenges
export async function GET(request: NextRequest) {
  try {
    // Fetch all approved teams with their hackathonTrack (challenge)
    const teams = await prisma.team.findMany({
      where: {
        status: "approved"
      },
      select: {
        id: true,
        teamName: true,
        status: true,
        hackathonTrack: true
      },
      orderBy: {
        teamName: 'asc'
      }
    });

    // Group teams by challenge
    const teamsByChallenge: Record<string, any[]> = {};

    teams.forEach(team => {
      // Use hackathonTrack as the challenge, fallback to "Uncategorized" if not available
      const challenge = team.hackathonTrack || "Uncategorized";
      
      // Initialize the challenge array if it doesn't exist
      if (!teamsByChallenge[challenge]) {
        teamsByChallenge[challenge] = [];
      }
      
      // Add team to the appropriate challenge category
      teamsByChallenge[challenge].push({
        id: team.id,
        teamName: team.teamName,
        status: team.status
      });
    });

    return NextResponse.json({ challenges: teamsByChallenge });
  } catch (error) {
    console.error("Error fetching teams by challenge:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب الفرق حسب التحديات" },
      { status: 500 }
    );
  }
}

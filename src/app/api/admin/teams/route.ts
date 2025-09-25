import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Ensure this route is dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get('search');
    
    let teams;
    
    if (searchTerm) {
      // Enhanced search across team and participant fields
      teams = await prisma.team.findMany({
        where: {
          OR: [
            // Search in team fields
            { teamName: { contains: searchTerm } },
            { ideaName: { contains: searchTerm } },
            { hackathonTrack: { contains: searchTerm } },
            { ideaDescription: { contains: searchTerm } },
            // Search in participants (team members)
            {
              participants: {
                some: {
                  OR: [
                    // Search by email
                    { email: { contains: searchTerm.toLowerCase() } },
                    // Search by fullName
                    { fullName: { contains: searchTerm } },
                    // Search by legacy name fields
                    { firstName: { contains: searchTerm } },
                    { secondName: { contains: searchTerm } },
                    { familyName: { contains: searchTerm } },
                    // Search by contact number
                    { contactNumber: { contains: searchTerm } },
                    { phoneNumber: { contains: searchTerm } },
                  ]
                }
              }
            }
          ]
        },
        include: {
          participants: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } else {
      // No search term, return all teams
      teams = await prisma.team.findMany({
        include: {
          participants: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    }

    return NextResponse.json(teams)
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}

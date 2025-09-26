import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JwtPayload {
  participantId: string;
  email: string;
  role: string;
  teamId?: string;
  isLeader?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get('token');

    if (!tokenCookie) {
      return NextResponse.json({ error: 'Authentication token not found.' }, { status: 401 });
    }

    const token = tokenCookie.value;
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    // Authorization: Only team leaders can add members
    if (!decoded.isLeader) {
      return NextResponse.json({ error: 'Only team leaders can add members.' }, { status: 403 });
    }

    const { teamId } = decoded;
    const newMemberData = await request.json();

    // Validation
    if (!newMemberData.email || !newMemberData.firstName || !newMemberData.nationalId) {
        return NextResponse.json({ error: 'Required fields are missing.' }, { status: 400 });
    }

    // Check if email already exists
    const existingParticipant = await prisma.participant.findUnique({
        where: { email: newMemberData.email },
    });

    if (existingParticipant) {
        return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 });
    }

    // Generate password for the new member using email prefix + "123"
    const emailPrefix = newMemberData.email.split('@')[0];
    const password = `${emailPrefix}123`;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log(`🔐 Generating password for new team member ${newMemberData.email}:`);
    console.log(`   - Email prefix: "${emailPrefix}"`);
    console.log(`   - Password: "${password}"`);

    const newParticipant = await prisma.participant.create({
      data: {
        ...newMemberData,
        isLeader: false, // New members are never leaders
        teamId: teamId,
        passwordHash: hashedPassword, // Add password hash for the new member
      },
    });
    
    console.log(`✅ Password created for new team member ${newMemberData.email}`);

    return NextResponse.json(newParticipant, { status: 201 });

  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}

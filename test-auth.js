// Simple test script to verify authentication flow
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Test JWT creation (simulating login)
const testParticipant = {
  id: 'test-participant-id',
  participantId: 'test-participant-id', // For backward compatibility
  email: 'test@example.com',
  role: 'participant'
};

const testMentor = {
  id: 'test-mentor-id',
  mentorId: 'test-mentor-id', // For backward compatibility
  email: 'mentor@example.com',
  role: 'mentor'
};

// Create participant token
const participantToken = jwt.sign(testParticipant, JWT_SECRET, { expiresIn: '7d' });
console.log('Generated participant token:', participantToken);

// Create mentor token
const mentorToken = jwt.sign(testMentor, JWT_SECRET, { expiresIn: '7d' });
console.log('Generated mentor token:', mentorToken);

// Test participant token verification
try {
  console.log('\n--- VERIFYING PARTICIPANT TOKEN ---');
  const decodedParticipant = jwt.verify(participantToken, JWT_SECRET);
  console.log('Decoded participant token:', decodedParticipant);
  
  if (decodedParticipant.id) {
    console.log('✅ id found in token:', decodedParticipant.id);
  } else {
    console.log('❌ id NOT found in token');
  }
  
  if (decodedParticipant.participantId) {
    console.log('✅ participantId found in token (backward compatibility):', decodedParticipant.participantId);
  } else {
    console.log('❌ participantId NOT found in token');
  }
} catch (error) {
  console.log('❌ Participant JWT verification failed:', error.message);
}

// Test mentor token verification
try {
  console.log('\n--- VERIFYING MENTOR TOKEN ---');
  const decodedMentor = jwt.verify(mentorToken, JWT_SECRET);
  console.log('Decoded mentor token:', decodedMentor);
  
  if (decodedMentor.id) {
    console.log('✅ id found in token:', decodedMentor.id);
  } else {
    console.log('❌ id NOT found in token');
  }
  
  if (decodedMentor.mentorId) {
    console.log('✅ mentorId found in token (backward compatibility):', decodedMentor.mentorId);
  } else {
    console.log('❌ mentorId NOT found in token');
  }
} catch (error) {
  console.log('❌ Mentor JWT verification failed:', error.message);
}

// Test script to verify gh CLI command structure
const { spawn } = require('child_process');

// Test 1: Check if --body-file works
console.log('Test 1: Checking gh pr review --body-file syntax...');
const test1 = spawn('gh', ['pr', 'review', '--help'], { shell: true });
test1.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('--body-file')) {
    console.log('✓ --body-file flag is supported');
  } else if (output.includes('--body')) {
    console.log('✓ --body flag found');
    console.log('  Note: May need to test if --body-file is available');
  }
});
test1.on('close', () => {
  console.log('Test 1 complete\n');

  // Test 2: Simulate the problematic scenario
  console.log('Test 2: Simulating multi-comment submission...');

  const testPayload = {
    event: 'COMMENT',
    body: 'Test review',
    comments: Array(23).fill(null).map((_, i) => ({
      path: 'test.js',
      line: i + 1,
      body: `Comment ${i + 1}`
    }))
  };

  console.log(`Creating payload with ${testPayload.comments.length} comments`);
  console.log(`JSON payload length: ${JSON.stringify(testPayload).length} bytes`);
  console.log('\nTest 2 complete - would need actual PR to test submission');
});

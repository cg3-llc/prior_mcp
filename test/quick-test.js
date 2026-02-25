// Quick test validation
const { formatResults } = require('../dist/utils.js');

// Test the fixed issues
console.log('Testing formatResults with null values...');
try {
  const testData = {
    results: [
      { id: 'k_valid', title: 'Valid' },
      null,
      { id: 'k_valid2', title: 'Valid 2' }
    ]
  };
  
  const result = formatResults(testData);
  console.log('✓ Null handling test passed');
  console.log('Result includes feedback nudge:', result.includes('call prior_feedback'));
} catch (error) {
  console.log('✗ Null handling test failed:', error.message);
}

console.log('\nTesting undefined handling...');
try {
  const result = formatResults(undefined);
  console.log('✓ Undefined handling test passed, result:', result);
} catch (error) {
  console.log('✗ Undefined handling test failed:', error.message);
}

console.log('\nBasic functionality tests completed.');
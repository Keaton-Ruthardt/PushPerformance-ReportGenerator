/**
 * Debug Blake Weiman search issue
 */

// Test the string matching logic
const blakeWeimanName = "Blake  Weiman"; // Double space from VALD
const searchTerm = "blake w";

console.log('🔍 Testing string matching logic:\n');

console.log('Original name:', JSON.stringify(blakeWeimanName));
console.log('Search term:', JSON.stringify(searchTerm));
console.log('');

// Test 1: Original logic (what was failing)
const original = blakeWeimanName.toLowerCase().includes(searchTerm.toLowerCase());
console.log('Test 1 - Original logic:');
console.log(`  "${blakeWeimanName.toLowerCase()}".includes("${searchTerm.toLowerCase()}")`);
console.log(`  Result: ${original} ${original ? '✅' : '❌'}`);
console.log('');

// Test 2: Normalized logic (what should work)
const normalized = blakeWeimanName.toLowerCase().replace(/\s+/g, ' ').includes(searchTerm.toLowerCase());
console.log('Test 2 - Normalized spaces:');
console.log(`  "${blakeWeimanName.toLowerCase().replace(/\s+/g, ' ')}".includes("${searchTerm.toLowerCase()}")`);
console.log(`  Result: ${normalized} ${normalized ? '✅' : '❌'}`);
console.log('');

// Test with Blake Wilson for comparison
const blakeWilsonName = "Blake Wilson";
const wilsonMatch = blakeWilsonName.toLowerCase().includes(searchTerm.toLowerCase());
console.log('Comparison - Blake Wilson:');
console.log(`  "${blakeWilsonName.toLowerCase()}".includes("${searchTerm.toLowerCase()}")`);
console.log(`  Result: ${wilsonMatch} ${wilsonMatch ? '✅' : '❌'}`);

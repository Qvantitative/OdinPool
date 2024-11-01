(async () => {
  const ECPair = await import('ecpair');

  console.log('\nECPair functions:');
  Object.keys(ECPair).forEach(key => {
    console.log(`- ${key}`);
  });

  // Log BitcoinJS-lib object structure
  console.log('BitcoinJS-lib object structure:');
  Object.keys(bitcoin).forEach(key => {
    console.log(`- ${key}: ${typeof bitcoin[key]}`);
  });

  // Log available networks
  console.log('\nAvailable networks:', Object.keys(bitcoin.networks));

  // Log Transaction object methods
  console.log('\nTransaction object methods:');
  Object.keys(bitcoin.Transaction.prototype).forEach(key => {
    console.log(`- ${key}`);
  });

  // Log available payment types
  console.log('\nAvailable payment types:');
  Object.keys(bitcoin.payments).forEach(key => {
    console.log(`- ${key}`);
  });
})();

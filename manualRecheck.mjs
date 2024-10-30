// manualRecheck.mjs

import { updateAllData } from './updateBlockchainData.mjs';

async function manualRecheckZeroInscriptions() {
  console.log('Starting manual recheck of zero inscription blocks');
  try {
    await updateAllData(false, true);
    console.log('Manual recheck completed successfully');
  } catch (error) {
    console.error('Error during manual recheck:', error);
  }
}

manualRecheckZeroInscriptions();
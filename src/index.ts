import express from 'express';
import { ENV } from './config/env';
import { metaApiWorker } from './queue/metaapi.queue';

const app = express();
app.use(express.json());

// Readiness probe for continuous cloud operations
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date() });
});

// Event listener loops safely ensuring worker stability
metaApiWorker.on('completed', (job) => {
  console.log(`[Queue Success] Task completed cleanly: Job ID ${job.id}`);
});

metaApiWorker.on('failed', (job, err) => {
  console.error(`[Queue Failure] Job ID ${job?.id} failed with message: ${err.message}`);
});

app.listen(ENV.PORT, () => {
  console.log(`🚀 PesaMatrix Engine Core running flawlessly on port ${ENV.PORT}`);
});

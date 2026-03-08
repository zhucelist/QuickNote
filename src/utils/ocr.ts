import { createWorker } from 'tesseract.js';

export const recognizeText = async (image: string, language: string = 'chi_sim+eng') => {
  const worker = await createWorker(language);
  const ret = await worker.recognize(image);
  await worker.terminate();
  return ret.data.text;
};

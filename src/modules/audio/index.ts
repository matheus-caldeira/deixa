export * from "./domain/speech";
export type {
  AudioAsset,
  AudioAssetRepository,
  ConcurrencyGate,
  TtsProvider,
  TtsProviderName,
} from "./application/ports";
export { makeGetSpeechAudio, makeListCachedSpeech, type SpeechAudio } from "./application/get-speech-audio";
export { makeSynthesizeLines, type BatchSynthesis } from "./application/synthesize-lines";

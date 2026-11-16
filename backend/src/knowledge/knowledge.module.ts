import { Module } from "@nestjs/common";
import { KnowledgeChunkingService } from "./knowledge-chunking.service";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeEmbeddingService } from "./knowledge-embedding.service";
import { KnowledgeExtractorService } from "./knowledge-extractor.service";
import { KnowledgeHubService } from "./knowledge-hub.service";
import { KnowledgeMockSeederService } from "./knowledge-mock-seeder.service";
import { KnowledgeObjectStorageService } from "./knowledge-object-storage.service";

@Module({
  controllers: [KnowledgeController],
  providers: [
    KnowledgeHubService,
    KnowledgeChunkingService,
    KnowledgeEmbeddingService,
    KnowledgeExtractorService,
    KnowledgeObjectStorageService,
    KnowledgeMockSeederService
  ],
  exports: [KnowledgeHubService, KnowledgeEmbeddingService]
})
export class KnowledgeModule {}

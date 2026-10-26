import type { Property } from "@/types/property";

export interface PropertyRepository {
  listPublished(): Promise<readonly Property[]>;
  findPublishedById(id: string): Promise<Property | null>;
}

import { InMemoryProgressRepository } from "@/repositories/in-memory-progress-repository";
import { defineProgressRepositoryContract } from "./progress-repository.contract";

defineProgressRepositoryContract("in-memory", () => new InMemoryProgressRepository());

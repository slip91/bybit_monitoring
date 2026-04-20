import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { getDatabasePath } from "../shared/database-path";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url: toPrismaSqliteUrl(getDatabasePath()),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

function toPrismaSqliteUrl(dbPath: string) {
  return dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`;
}

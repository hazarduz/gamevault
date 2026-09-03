// The "howlongtobeat" package may not ship its own TypeScript
// declarations in every published version. This fallback declaration
// keeps the build from failing on a missing-types error regardless —
// we only use a couple of loosely-typed fields from its results anyway
// (see lib/hltb.ts).
declare module "howlongtobeat" {
  export class HowLongToBeatService {
    search(query: string): Promise<any[]>;
    detail(id: string): Promise<any>;
  }
}

import { describe, expect, it } from "vitest";
import { auditCsvHeader, auditRowToCsv, auditRowToPlain } from "./export";

const row = {
  id: 7,
  ts: new Date("2026-09-11T12:00:00Z"),
  actorType: "admin" as const,
  actorId: "a1",
  action: "user.rename",
  targetUserId: "u1",
  before: { Name: 'old "quoted"' },
  after: { Name: "new,comma" },
  detail: null,
  requestId: "r1",
};

describe("audit export", () => {
  it("renders a CSV row with quoting", () => {
    expect(auditCsvHeader()).toBe("id,ts,actor_type,actor_id,action,target_user_id,before,after,detail,request_id\n");
    expect(auditRowToCsv(row)).toBe('7,2026-09-11T12:00:00.000Z,admin,a1,user.rename,u1,"{""Name"":""old \\""quoted\\""""}","{""Name"":""new,comma""}",,r1\n');
  });
  it("renders plain JSON", () => {
    expect(auditRowToPlain(row)).toMatchObject({ id: 7, ts: "2026-09-11T12:00:00.000Z", actor_type: "admin", before: { Name: 'old "quoted"' } });
  });
});

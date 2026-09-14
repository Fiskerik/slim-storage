import { subtractPendingDeleteEstimate, undoPendingDelete } from "./deleteUndo";

describe("delete undo state", () => {
  const first = { id: "first", sizeMB: 2.4 };
  const second = { id: "second", sizeMB: 5.1 };

  it("removes only the requested pending photo", () => {
    expect(undoPendingDelete([first, second], second)).toEqual({ pending: [first], restored: true });
  });

  it("does not restore a photo that is no longer pending", () => {
    expect(undoPendingDelete([first], second)).toEqual({ pending: [first], restored: false });
  });

  it("corrects the session estimate without going below zero", () => {
    expect(subtractPendingDeleteEstimate({ deleted: 2, freed: 7.5 }, second)).toEqual({ deleted: 1, freed: 2.4 });
    expect(subtractPendingDeleteEstimate({ deleted: 0, freed: 0 }, second)).toEqual({ deleted: 0, freed: 0 });
  });
});

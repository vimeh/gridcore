import { CellAddress } from "@gridcore/core/src/domain/models";

// Try creating addresses both ways
const addr1 = new CellAddress(1, 1);
console.log("Direct new:", addr1, "row:", addr1.row, "col:", addr1.col);

const addr2Result = CellAddress.create(1, 1);
if (addr2Result.ok) {
  console.log("Factory create:", addr2Result.value, "row:", addr2Result.value.row, "col:", addr2Result.value.col);
}

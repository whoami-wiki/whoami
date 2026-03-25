export function ScoreTable({
  headers,
  rows,
  scoreStart = 2,
}: {
  headers: string;
  rows: string;
  scoreStart?: number;
}) {
  const parsedHeaders: string[] = JSON.parse(headers);
  const parsedRows: string[][] = JSON.parse(rows);

  // Find the max value in each score column
  const maxPerCol: number[] = [];
  for (let col = scoreStart; col < parsedHeaders.length; col++) {
    let max = -Infinity;
    for (const row of parsedRows) {
      const val = parseFloat(row[col]);
      if (!isNaN(val) && val > max) max = val;
    }
    maxPerCol[col] = max;
  }

  const lastCol = parsedHeaders.length - 1;
  const stickyClass =
    "sticky right-0 border-l border-l-neutral-200 dark:border-l-neutral-500 bg-neutral-50 dark:bg-[#2e2e2e]";
  const frozenStyle = { width: 112, minWidth: 112, maxWidth: 112 } as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            {parsedHeaders.map((h, i) => (
              <th
                key={i}
                style={{
                  borderBottomColor: "var(--border-primary)",
                  ...(i === lastCol ? frozenStyle : {}),
                }}
                className={`py-2.5 px-3 font-normal text-neutral-500 dark:text-neutral-400 border-b${i >= scoreStart ? " text-right" : " text-left"}${i === lastCol ? ` ${stickyClass}` : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsedRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const val = parseFloat(cell);
                const isBest =
                  ci >= scoreStart && !isNaN(val) && val === maxPerCol[ci];

                const frozen = ci === lastCol;

                return (
                  <td
                    key={ci}
                    style={{
                      borderBottomColor: "var(--border-muted)",
                      ...(frozen ? frozenStyle : {}),
                    }}
                    className={`${
                      isBest
                        ? `py-2.5 px-3 font-medium text-green-700 dark:text-green-400${frozen ? "" : " bg-green-50 dark:bg-green-950/30"}`
                        : "py-2.5 px-3 text-neutral-600 dark:text-neutral-400"
                    } border-b${ci < scoreStart ? " whitespace-nowrap" : " text-right tabular-nums"}${frozen ? ` ${stickyClass}${isBest ? " !bg-green-50 dark:!bg-[#243d2e]" : ""}` : ""}`}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

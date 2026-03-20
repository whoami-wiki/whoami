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
  const stickyClass = "sticky right-0 bg-neutral-50 dark:bg-neutral-800";
  const stickyStyle = {
    boxShadow: "-1px 0 0 0 var(--border-primary)",
  } as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-700">
            {parsedHeaders.map((h, i) => (
              <th
                key={i}
                className={`py-2.5 px-3 font-normal text-neutral-500 dark:text-neutral-400${i >= scoreStart ? " text-right" : " text-left"}${i === lastCol ? ` ${stickyClass}` : ""}`}
                style={i === lastCol ? stickyStyle : undefined}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsedRows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-neutral-100 dark:border-neutral-800"
            >
              {row.map((cell, ci) => {
                const val = parseFloat(cell);
                const isBest =
                  ci >= scoreStart && !isNaN(val) && val === maxPerCol[ci];

                const frozen = ci === lastCol;

                return (
                  <td
                    key={ci}
                    style={frozen ? stickyStyle : undefined}
                    className={`${
                      isBest
                        ? `py-2.5 px-3 font-medium text-green-700 dark:text-green-400${frozen ? "" : " bg-green-50 dark:bg-green-950/30"}`
                        : "py-2.5 px-3 text-neutral-600 dark:text-neutral-400"
                    }${ci < scoreStart ? " whitespace-nowrap" : " text-right tabular-nums"}${frozen ? ` ${stickyClass}${isBest ? " !bg-green-50 dark:!bg-green-900/40" : ""}` : ""}`}
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

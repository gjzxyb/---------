type DataTableProps = {
  headers?: React.ReactNode[];
  rows?: React.ReactNode[][];
  emptyText?: string;
  children?: React.ReactNode;
};

export function DataTable({
  headers = [],
  rows,
  emptyText = "暂无数据。",
  children,
}: DataTableProps) {
  const columnCount = Math.max(headers.length, 1);

  return (
    <div className="theme-card overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        {headers.length ? (
          <thead className="bg-slate-50">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        {children ? (
          children
        ) : (
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows?.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-4 py-4 text-sm text-slate-700"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}

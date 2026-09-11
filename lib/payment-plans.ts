import { shiftDate } from './manage-templates';
export function installmentSchedule(
  total: number,
  deposit: number,
  type: string,
  count: number,
  bookDate: string,
  dueDate: string,
) {
  if (
    !Number.isFinite(total) ||
    !Number.isFinite(deposit) ||
    !Number.isFinite(count)
  )
    throw Error('Enter valid payment amounts.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(bookDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
  )
    throw Error('Choose valid schedule dates.');
  total = Math.max(0, Math.round(total));
  deposit = Math.min(total, Math.max(0, Math.round(deposit)));
  if (type === 'Pay in full' || dueDate <= bookDate)
    return [{ date: bookDate, amount: total, label: 'Full balance' }];
  const result = deposit
    ? [{ date: bookDate, amount: deposit, label: 'Deposit' }]
    : [];
  if (total === deposit) return result;
  let dates: string[] = [];
  if (type === 'Deposit + monthly payments') {
    for (let m = 1; m <= 120; m++) {
      const day = shiftDate(bookDate, m, 'Months');
      if (day >= dueDate) break;
      dates.push(day);
    }
    dates.push(dueDate);
  } else if (type === 'Deposit + equal installments') {
    const start = Date.parse(bookDate + 'T12:00:00Z'),
      end = Date.parse(dueDate + 'T12:00:00Z'),
      n = Math.min(
        24,
        Math.max(1, Math.floor(count)),
        Math.max(1, Math.floor((end - start) / 86400000)),
      );
    dates = Array.from({ length: n }, (_, i) =>
      new Date(start + ((end - start) * (i + 1)) / n)
        .toISOString()
        .slice(0, 10),
    );
  } else dates = [dueDate];
  const balance = total - deposit,
    each = Math.floor(balance / dates.length);
  return [
    ...result,
    ...dates.map((date, i) => ({
      date,
      amount: i === dates.length - 1 ? balance - each * i : each,
      label: 'Installment ' + (i + 1),
    })),
  ];
}

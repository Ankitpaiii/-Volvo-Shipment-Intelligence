export function getDeadlineLabel(deadline) {
  const diffMs = new Date(deadline) - new Date();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) {
    return { label: 'OVERDUE', cls: 'text-red-600 font-bold dark:text-red-400' };
  }
  if (diffHours < 1) {
    return { label: 'Due in < 1 hour', cls: 'text-red-500 font-semibold' };
  }
  if (diffHours < 24) {
    return { label: `Due in ${diffHours}h`, cls: 'text-orange-500 font-semibold' };
  }
  if (diffDays === 1) {
    return { label: 'Due tomorrow', cls: 'text-amber-500' };
  }
  return { label: `Due in ${diffDays} days`, cls: 'text-gray-500 dark:text-gray-400' };
}

const sizeClasses = {
  sm: 'h-7 w-7 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-14 w-14 rounded-2xl'
};

const textSizeClasses = {
  sm: {
    brand: 'text-[10px]',
    os: 'text-xs'
  },
  md: {
    brand: 'text-xs',
    os: 'text-lg'
  },
  lg: {
    brand: 'text-sm',
    os: 'text-4xl'
  }
};

export default function SiteLogo({ compact = false, size = 'sm', className = '' }) {
  const imageClass = sizeClasses[size] || sizeClasses.sm;
  const textClass = textSizeClasses[size] || textSizeClasses.sm;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/logo.jpeg"
        alt="CreatorOps OS"
        className={`${imageClass} shrink-0 object-cover shadow-sm ring-1 ring-white/10`}
      />
      {!compact && (
        <div>
          <div className={`${textClass.brand} font-bold uppercase tracking-[0.22em] text-mint`}>CreatorOps</div>
          <div className={`${textClass.os} font-bold text-[var(--text)]`}>OS</div>
        </div>
      )}
    </div>
  );
}

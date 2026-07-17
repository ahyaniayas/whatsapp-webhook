export function navBar(active: 'dashboard' | 'queue' | 'logger' | 'app-keys' | 'access-log'): string {
    const links: { href: string; label: string; key: string }[] = [
        { href: '/dashboard', label: 'Dashboard', key: 'dashboard' },
        { href: '/api/v1/wa-api/queue', label: 'Queue Monitor', key: 'queue' },
        { href: '/app-keys', label: 'App Keys', key: 'app-keys' },
        { href: '/logger', label: 'Logger', key: 'logger' },
        { href: '/access-log', label: 'Access Log', key: 'access-log' },
    ];
    return `
    <style>
        .wa-nav { background:white;border-bottom:1px solid #e2e8f0;padding:0 2rem;display:flex;align-items:center;gap:0.25rem;height:54px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.04);overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
        .wa-nav::-webkit-scrollbar { display:none; }
        .wa-nav-brand { font-weight:700;color:#10b981;font-size:1rem;margin-right:1.25rem;white-space:nowrap;flex-shrink:0; }
        .wa-nav-link { padding:0.375rem 0.75rem;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none;transition:all 0.15s;white-space:nowrap;flex-shrink:0; }
        .wa-nav-logout { margin-left:auto;padding:0.375rem 0.875rem;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none;color:#64748b;border:1px solid #e2e8f0;background:white;transition:all 0.15s;white-space:nowrap;flex-shrink:0; }
        @media (max-width: 640px) {
            .wa-nav { padding:0 1rem; gap:0.125rem; }
            .wa-nav-brand { margin-right:0.75rem; font-size:0.875rem; }
            .wa-nav-link { padding:0.375rem 0.5rem; font-size:0.8125rem; }
            .wa-nav-logout { margin-left:0.5rem; padding:0.375rem 0.625rem; font-size:0.8125rem; }
        }
    </style>
    <nav class="wa-nav">
        <span class="wa-nav-brand">&#9679; WA Admin</span>
        ${links.map(l => `
        <a href="${l.href}" class="wa-nav-link" style="color:${active === l.key ? '#10b981' : '#64748b'};background:${active === l.key ? '#f0fdf4' : 'transparent'};">${l.label}</a>
        `).join('')}
        <a href="/logout" class="wa-nav-logout">Logout</a>
    </nav>`;
}

export function escapeHtml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

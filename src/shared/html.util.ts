export function navBar(active: 'dashboard' | 'queue' | 'logger' | 'app-keys' | 'access-log'): string {
    const links: { href: string; label: string; key: string }[] = [
        { href: '/dashboard', label: 'Dashboard', key: 'dashboard' },
        { href: '/api/v1/wa-api/queue', label: 'Queue Monitor', key: 'queue' },
        { href: '/app-keys', label: 'App Keys', key: 'app-keys' },
        { href: '/logger', label: 'Logger', key: 'logger' },
        { href: '/access-log', label: 'Access Log', key: 'access-log' },
    ];
    return `
    <nav style="background:white;border-bottom:1px solid #e2e8f0;padding:0 2rem;display:flex;align-items:center;gap:0.25rem;height:54px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <span style="font-weight:700;color:#10b981;font-size:1rem;margin-right:1.25rem;white-space:nowrap;">&#9679; WA Admin</span>
        ${links.map(l => `
        <a href="${l.href}" style="padding:0.375rem 0.75rem;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none;color:${active === l.key ? '#10b981' : '#64748b'};background:${active === l.key ? '#f0fdf4' : 'transparent'};transition:all 0.15s;">${l.label}</a>
        `).join('')}
        <a href="/logout" style="margin-left:auto;padding:0.375rem 0.875rem;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none;color:#64748b;border:1px solid #e2e8f0;background:white;transition:all 0.15s;">Logout</a>
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

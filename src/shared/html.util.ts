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
        .wa-nav-links { display:flex; align-items:center; gap:0.25rem; flex:1; min-width:0; }
        .wa-nav-link { padding:0.375rem 0.75rem;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none;transition:all 0.15s;white-space:nowrap;flex-shrink:0; }
        .wa-nav-logout { margin-left:auto;padding:0.375rem 0.875rem;border-radius:6px;font-size:0.875rem;font-weight:600;text-decoration:none;color:#64748b;border:1px solid #e2e8f0;background:white;transition:all 0.15s;white-space:nowrap;flex-shrink:0; }
        .wa-nav-toggle-checkbox { display:none; }
        .wa-nav-toggle-label { display:none; }
        @media (max-width: 640px) {
            .wa-nav { padding:0 1rem; overflow-x:visible; }
            .wa-nav-brand { margin-right:auto; font-size:0.9375rem; }
            .wa-nav-toggle-label { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; border:1px solid #e2e8f0; background:white; font-size:1rem; cursor:pointer; color:#475569; flex-shrink:0; transition:all 0.15s; }
            .wa-nav-toggle-checkbox:checked ~ .wa-nav-toggle-label { background:#f0fdf4; border-color:#bbf7d0; color:#10b981; }

            .wa-nav-links {
                display:none;
                flex-direction:column;
                align-items:stretch;
                gap:0.125rem;
                position:absolute;
                top:calc(100% + 0.5rem);
                left:0.75rem;
                right:0.75rem;
                background:white;
                border:1px solid #e2e8f0;
                border-radius:12px;
                box-shadow:0 12px 28px rgba(0,0,0,0.12);
                padding:0.5rem;
                z-index:99;
            }
            .wa-nav-toggle-checkbox:checked ~ .wa-nav-links { display:flex; }
            .wa-nav-link { width:100%; padding:0.625rem 0.75rem; }
            .wa-nav-link:active { background:#f8fafc; }
            .wa-nav-logout { margin-left:0; width:100%; text-align:center; margin-top:0.375rem; padding-top:0.75rem; border:none; border-top:1px solid #f1f5f9; border-radius:0; }
        }
    </style>
    <nav class="wa-nav">
        <span class="wa-nav-brand">&#9679; WA Admin</span>
        <input type="checkbox" id="waNavToggle" class="wa-nav-toggle-checkbox" />
        <label for="waNavToggle" class="wa-nav-toggle-label" aria-label="Menu">&#9776;</label>
        <div class="wa-nav-links">
            ${links.map(l => `
            <a href="${l.href}" class="wa-nav-link" style="color:${active === l.key ? '#10b981' : '#64748b'};background:${active === l.key ? '#f0fdf4' : 'transparent'};">${l.label}</a>
            `).join('')}
            <a href="/logout" class="wa-nav-logout">Logout</a>
        </div>
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

import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AppKeyService } from './app-key.service';
import { navBar, escapeHtml } from '../shared/html.util';
import { getWaPhoneNumbers } from '../shared/wa-phone-numbers.util';
import type { Request, Response } from 'express';

@Controller('app-keys')
@UseGuards(AuthGuard)
export class AppKeyController {
    constructor(
        private readonly appKeyService: AppKeyService,
        private readonly authService: AuthService,
    ) {}

    private currentUser(req: Request): string {
        const token = (req.cookies as Record<string, string>)?._wa_admin;
        return this.authService.verifyToken(token) || 'admin';
    }

    @Get()
    async list(@Req() req: Request, @Res() res: Response) {
        const filterApp      = (req.query.app as string) || '';
        const filterMode     = (req.query.mode as string) || '';
        const filterIsActive = (req.query.is_active as string) || '';
        const msg            = req.query.msg as string;

        const records = await this.appKeyService.list({
            app: filterApp || undefined,
            mode: filterMode || undefined,
            is_active: filterIsActive || undefined,
        });

        const waPhoneNumbers = getWaPhoneNumbers();
        const phoneOptionsHtml = (selectedId?: string) => waPhoneNumbers.map((p) =>
            `<option value="${escapeHtml(p.id)}" ${selectedId === p.id ? 'selected' : ''}>${escapeHtml(p.phone)} (${escapeHtml(p.id)})</option>`
        ).join('');
        const senderLabel = (waPhoneId: string | null) => {
            if (!waPhoneId) return '<span class="text-muted">-</span>';
            const match = waPhoneNumbers.find((p) => p.id === waPhoneId);
            return match ? escapeHtml(match.phone) : `<span class="text-muted" title="Tidak terdaftar di WA_PHONE_NUMBERS">${escapeHtml(waPhoneId)}</span>`;
        };

        const rows = records.map((r) => {
            const maskedKey = r.key ? r.key.substring(0, 8) + '••••••••' : '-';
            const createdAt = r.created_at
                ? new Date(r.created_at).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' })
                : '-';
            const activeClass = r.is_active === 'Y' ? 'active' : 'inactive';
            const activeLabel = r.is_active === 'Y' ? 'Aktif' : 'Nonaktif';
            const toggleLabel = r.is_active === 'Y' ? 'Nonaktifkan' : 'Aktifkan';
            const toggleClass = r.is_active === 'Y' ? 'btn-warn' : 'btn-success';
            const safeIps = escapeHtml(r.ips || '');
            const safeMode = escapeHtml(r.mode || 'DEV');
            const safeWaPhoneId = escapeHtml(r.wa_phone_id || '');
            return `
            <tr>
                <td class="font-mono text-muted">${r.id}</td>
                <td><strong>${escapeHtml(r.app)}</strong></td>
                <td class="font-mono" title="${escapeHtml(r.key)}" style="cursor:help;">${escapeHtml(maskedKey)}</td>
                <td><span class="badge mode-${(r.mode || '').toLowerCase()}">${safeMode}</span></td>
                <td class="font-mono text-muted" style="font-size:0.8rem;">${r.ips ? safeIps : '<span class="text-muted">-</span>'}</td>
                <td class="font-mono" style="font-size:0.8rem;">${senderLabel(r.wa_phone_id)}</td>
                <td><span class="badge ${activeClass}">${activeLabel}</span></td>
                <td class="text-muted" style="font-size:0.8rem;">${escapeHtml(r.created_by || '-')}<br>${createdAt}</td>
                <td style="white-space:nowrap;">
                    <button type="button" class="btn-action btn-edit"
                        onclick="openEdit(${r.id}, '${safeMode}', '${safeIps}', '${escapeHtml(r.app)}', '${safeWaPhoneId}')">
                        Edit
                    </button>
                    <form method="POST" action="/app-keys/${r.id}/regen-key" style="display:inline;"
                        onsubmit="return confirm('Regenerasi key \\'${escapeHtml(r.app)}\\'?\\nKey lama akan diganti dengan key baru.')">
                        <button type="submit" class="btn-action btn-regen">Regen Key</button>
                    </form>
                    <form method="POST" action="/app-keys/${r.id}/toggle" style="display:inline;"
                        onsubmit="return confirm('${toggleLabel} App Key \\'${escapeHtml(r.app)}\\'?')">
                        <button type="submit" class="btn-action ${toggleClass}">${toggleLabel}</button>
                    </form>
                    <form method="POST" action="/app-keys/${r.id}/delete" style="display:inline;"
                        onsubmit="return confirm('Hapus App Key \\'${escapeHtml(r.app)}\\'?\\nTindakan ini tidak dapat dibatalkan.')">
                        <button type="submit" class="btn-action btn-danger">Hapus</button>
                    </form>
                </td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>App Key Management - WhatsApp Admin</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f8fafc; color: #1e293b; }
        main { padding: 2rem; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; }
        h1::before { content: ""; display: inline-block; width: 8px; height: 28px; background: #f59e0b; border-radius: 4px; }

        .alert { padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.875rem; }
        .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }

        .form-group { display: flex; flex-direction: column; gap: 0.25rem; }
        label { font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        input[type="text"], select { padding: 0.625rem 0.875rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; color: #334155; background: white; outline: none; transition: all 0.2s; width: 100%; }
        input:focus, select:focus { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.12); }
        input::placeholder { color: #94a3b8; }

        .btn-primary { background: #f59e0b; color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; padding: 0.625rem 1.25rem; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .btn-primary:hover { background: #d97706; }
        .btn-secondary { background: white; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; font-weight: 600; padding: 0.5rem 1.25rem; cursor: pointer; transition: all 0.15s; }
        .btn-secondary:hover { background: #f1f5f9; }

        /* Filter Form */
        .filter-form { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end; }
        .filter-group { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 140px; }
        .filter-label { font-size: 0.7rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .btn-filter { background: #f59e0b; color: white; border: none; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; padding: 0.5625rem 1.125rem; cursor: pointer; white-space: nowrap; transition: background 0.2s; height: 36px; }
        .btn-filter:hover { background: #d97706; }
        .btn-reset { background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; padding: 0.5rem 1rem; cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center; height: 36px; transition: all 0.15s; }
        .btn-reset:hover { background: #f8fafc; }

        /* Table */
        .table-wrapper { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; min-width: 960px; }
        th { background: #f8fafc; padding: 0.875rem 1rem; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 0.875rem 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #f8fafc; }

        .badge { padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
        .active   { background: #dcfce7; color: #16a34a; }
        .inactive { background: #f1f5f9; color: #64748b; }
        .mode-dev  { background: #fef3c7; color: #92400e; }
        .mode-prod { background: #dbeafe; color: #1e40af; }

        .font-mono { font-family: monospace; }
        .text-muted { color: #94a3b8; }

        .btn-action { padding: 0.3125rem 0.6875rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s; margin-right: 0.25rem; }
        .btn-edit:hover  { background: #bae6fd; }
        .btn-edit    { background: #e0f2fe; color: #0369a1; }
        .btn-regen   { background: #f3e8ff; color: #7e22ce; }
        .btn-regen:hover { background: #e9d5ff; }
        .btn-warn    { background: #fef3c7; color: #92400e; }
        .btn-warn:hover  { background: #fde68a; }
        .btn-success { background: #dcfce7; color: #16a34a; }
        .btn-success:hover { background: #bbf7d0; }
        .btn-danger  { background: #fee2e2; color: #dc2626; }
        .btn-danger:hover  { background: #fecaca; }

        /* Dialog / Modal — centered via position fixed */
        dialog {
            border: none;
            border-radius: 14px;
            padding: 0;
            width: calc(100% - 2rem);
            max-width: 460px;
            box-shadow: 0 24px 64px rgba(0,0,0,0.2);
            position: fixed;
            inset: 0;
            margin: auto;
        }
        dialog::backdrop { background: rgba(15,23,42,0.55); }
        .dialog-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .dialog-header h2 { font-size: 1.05rem; font-weight: 700; color: #0f172a; }
        .dialog-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #94a3b8; line-height: 1; padding: 0.25rem; border-radius: 4px; }
        .dialog-close:hover { color: #475569; background: #f1f5f9; }
        .dialog-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.125rem; }
        .dialog-hint { font-size: 0.8rem; color: #94a3b8; }
        .dialog-hint code { background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 4px; font-family: monospace; color: #64748b; }
        .dialog-footer { padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem; }

        /* Filter collapse (mobile only) */
        .filter-toggle-checkbox { display: none; }
        .filter-toggle-label { display: none; }

        @media (max-width: 640px) {
            main { padding: 1rem; }
            h1 { font-size: 1.375rem; }
            .page-header { flex-wrap: wrap; gap: 0.75rem; }
            .filter-group { min-width: 100%; max-width: none !important; }
            .btn-filter, .btn-reset { width: 100%; justify-content: center; }
            .btn-action { display: inline-block; margin: 0 0.25rem 0.375rem 0; }

            .filter-toggle-label { display: flex; align-items: center; justify-content: space-between; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.875rem 1.25rem; margin-bottom: 0.75rem; font-weight: 600; font-size: 0.875rem; color: #334155; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
            .filter-toggle-label .chev { transition: transform 0.2s; }
            .filter-toggle-checkbox:checked ~ .filter-toggle-label .chev { transform: rotate(180deg); }
            .filter-form { display: none; }
            .filter-toggle-checkbox:checked ~ .filter-form { display: flex; }
        }
    </style>
</head>
<body>
    ${navBar('app-keys')}
    <main>
        <div class="page-header">
            <h1>App Key Management</h1>
            <button type="button" class="btn-primary" onclick="document.getElementById('createModal').showModal()">+ Tambah App Key</button>
        </div>

        ${msg === 'created' ? '<div class="alert alert-success">&#10003; App Key berhasil dibuat. Key di-generate otomatis.</div>' : ''}
        ${msg === 'updated' ? '<div class="alert alert-success">&#10003; App Key berhasil diperbarui.</div>' : ''}
        ${msg === 'toggled' ? '<div class="alert alert-success">&#10003; Status App Key berhasil diubah.</div>' : ''}
        ${msg === 'deleted' ? '<div class="alert alert-success">&#10003; App Key berhasil dihapus.</div>' : ''}
        ${msg === 'regen'   ? '<div class="alert alert-success">&#10003; Key berhasil diregenerasi.</div>' : ''}

        <input type="checkbox" id="filterToggle" class="filter-toggle-checkbox" />
        <label for="filterToggle" class="filter-toggle-label">Filter <span class="chev">&#9662;</span></label>
        <form class="filter-form" method="GET" action="/app-keys">
            <div class="filter-group">
                <span class="filter-label">Nama Aplikasi</span>
                <input type="text" name="app" value="${escapeHtml(filterApp)}" placeholder="Cari app..." />
            </div>
            <div class="filter-group" style="max-width:120px;">
                <span class="filter-label">Mode</span>
                <select name="mode">
                    <option value="">Semua</option>
                    <option value="DEV"  ${filterMode === 'DEV'  ? 'selected' : ''}>DEV</option>
                    <option value="PROD" ${filterMode === 'PROD' ? 'selected' : ''}>PROD</option>
                </select>
            </div>
            <div class="filter-group" style="max-width:130px;">
                <span class="filter-label">Status</span>
                <select name="is_active">
                    <option value="">Semua</option>
                    <option value="Y" ${filterIsActive === 'Y' ? 'selected' : ''}>Aktif</option>
                    <option value="N" ${filterIsActive === 'N' ? 'selected' : ''}>Nonaktif</option>
                </select>
            </div>
            <button type="submit" class="btn-filter">Filter</button>
            <a href="/app-keys" class="btn-reset">Reset</a>
        </form>

        <div style="font-size:0.8125rem;color:#64748b;margin-bottom:0.625rem;">
            Menampilkan <strong>${records.length}</strong> record${filterApp || filterMode || filterIsActive ? ' (difilter)' : ''}
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>App</th>
                        <th>Key</th>
                        <th>Mode</th>
                        <th>Whitelist IPs</th>
                        <th>Nomor Pengirim</th>
                        <th>Status</th>
                        <th>Dibuat Oleh</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.length === 0
                        ? '<tr><td colspan="9" style="text-align:center;padding:2rem;" class="text-muted">Belum ada App Key</td></tr>'
                        : rows}
                </tbody>
            </table>
        </div>
    </main>

    <!-- Create Modal -->
    <dialog id="createModal">
        <div class="dialog-header">
            <h2>Tambah App Key Baru</h2>
            <button class="dialog-close" type="button" onclick="document.getElementById('createModal').close()">&#10005;</button>
        </div>
        <form method="POST" action="/app-keys" onsubmit="return confirm('Buat App Key baru?\\nKey akan di-generate otomatis.')">
            <div class="dialog-body">
                <p class="dialog-hint">Key akan di-generate otomatis sebagai <code>UUID v7</code> saat disimpan.</p>
                <div class="form-group">
                    <label for="createApp">Nama Aplikasi</label>
                    <input type="text" id="createApp" name="app" placeholder="e.g. hris, payroll" required />
                </div>
                <div class="form-group">
                    <label for="createMode">Mode</label>
                    <select id="createMode" name="mode">
                        <option value="DEV">DEV</option>
                        <option value="PROD">PROD</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="createIps">Whitelist IP (opsional)</label>
                    <input type="text" id="createIps" name="ips" placeholder="192.168.1.1;10.0.0.2" />
                </div>
                <div class="form-group">
                    <label for="createWaPhoneId">Nomor Pengirim</label>
                    <select id="createWaPhoneId" name="wa_phone_id" required>
                        <option value="">-- Pilih nomor pengirim --</option>
                        ${phoneOptionsHtml()}
                    </select>
                </div>
            </div>
            <div class="dialog-footer">
                <button type="button" class="btn-secondary" onclick="document.getElementById('createModal').close()">Batal</button>
                <button type="submit" class="btn-primary">+ Tambah</button>
            </div>
        </form>
    </dialog>

    <!-- Edit Modal -->
    <dialog id="editModal">
        <div class="dialog-header">
            <h2>Edit App Key</h2>
            <button class="dialog-close" type="button" onclick="document.getElementById('editModal').close()">&#10005;</button>
        </div>
        <form id="editForm" method="POST" onsubmit="return confirm('Simpan perubahan pada App Key ini?')">
            <div class="dialog-body">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.75rem 1rem;">
                    <div style="font-size:0.7rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">Aplikasi</div>
                    <div id="editAppName" style="font-size:0.9375rem;font-weight:700;color:#0f172a;font-family:monospace;"></div>
                </div>
                <div class="form-group">
                    <label for="editMode">Mode</label>
                    <select id="editMode" name="mode">
                        <option value="DEV">DEV</option>
                        <option value="PROD">PROD</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="editIps">Whitelist IP (opsional)</label>
                    <input type="text" id="editIps" name="ips" placeholder="192.168.1.1;10.0.0.2" />
                </div>
                <div class="form-group">
                    <label for="editWaPhoneId">Nomor Pengirim</label>
                    <select id="editWaPhoneId" name="wa_phone_id" required>
                        <option value="">-- Pilih nomor pengirim --</option>
                        ${phoneOptionsHtml()}
                    </select>
                </div>
                <div class="form-group">
                    <label for="editNote">Catatan Perubahan (opsional)</label>
                    <input type="text" id="editNote" name="updated_note" placeholder="e.g. Update IP whitelist" />
                </div>
            </div>
            <div class="dialog-footer">
                <button type="button" class="btn-secondary" onclick="document.getElementById('editModal').close()">Batal</button>
                <button type="submit" class="btn-primary">Simpan Perubahan</button>
            </div>
        </form>
    </dialog>

    <script>
        function openEdit(id, mode, ips, app, waPhoneId) {
            document.getElementById('editAppName').textContent = app || '-';
            document.getElementById('editMode').value = mode;
            document.getElementById('editIps').value = ips || '';
            document.getElementById('editWaPhoneId').value = waPhoneId || '';
            document.getElementById('editNote').value = '';
            document.getElementById('editForm').action = '/app-keys/' + id + '/edit';
            document.getElementById('editModal').showModal();
        }

        document.querySelectorAll('dialog').forEach((d) => {
            d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
        });
    </script>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }

    @Post()
    async create(@Body() body: any, @Req() req: Request, @Res() res: Response) {
        await this.appKeyService.create({
            app: body.app,
            mode: body.mode === 'PROD' ? 'PROD' : 'DEV',
            ips: body.ips || undefined,
            wa_phone_id: body.wa_phone_id || undefined,
            created_by: this.currentUser(req),
        });
        return res.redirect('/app-keys?msg=created');
    }

    @Post(':id/edit')
    async update(@Param('id') id: string, @Body() body: any, @Req() req: Request, @Res() res: Response) {
        await this.appKeyService.update(Number(id), {
            mode: body.mode === 'PROD' ? 'PROD' : 'DEV',
            ips: body.ips || undefined,
            wa_phone_id: body.wa_phone_id || undefined,
            updated_by: this.currentUser(req),
            updated_note: body.updated_note || undefined,
        });
        return res.redirect('/app-keys?msg=updated');
    }

    @Post(':id/regen-key')
    async regenKey(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
        await this.appKeyService.regenKey(Number(id), this.currentUser(req));
        return res.redirect('/app-keys?msg=regen');
    }

    @Post(':id/toggle')
    async toggle(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
        await this.appKeyService.toggleActive(Number(id), this.currentUser(req));
        return res.redirect('/app-keys?msg=toggled');
    }

    @Post(':id/delete')
    async delete(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
        await this.appKeyService.softDelete(Number(id), this.currentUser(req));
        return res.redirect('/app-keys?msg=deleted');
    }
}

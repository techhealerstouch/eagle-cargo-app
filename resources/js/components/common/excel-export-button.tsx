import React, { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ExcelExportButtonProps {
    exportUrl: string;
    selectedIds?: number[];
    filters?: Record<string, any>;
    label?: string;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
}

export default function ExcelExportButton({
    exportUrl,
    selectedIds = [],
    filters = {},
    label = 'Export Excel',
    variant = 'outline',
    size = 'default',
    className = '',
}: ExcelExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = () => {
        setIsExporting(true);
        toast.info('Preparing Excel export...');

        const params = new URLSearchParams();

        if (selectedIds && selectedIds.length > 0) {
            params.append('ids', selectedIds.join(','));
        } else if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '' && value !== 'all') {
                    params.append(key, String(value));
                }
            });
        }

        const queryString = params.toString();
        const fullUrl = queryString ? `${exportUrl}?${queryString}` : exportUrl;

        // Trigger browser file download
        const link = document.createElement('a');
        link.href = fullUrl;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            setIsExporting(false);
            toast.success('Excel export started.');
        }, 1200);
    };

    return (
        <Button
            type="button"
            variant={variant}
            size={size}
            onClick={handleExport}
            disabled={isExporting}
            className={`gap-2 ${className}`}
        >
            {isExporting ? (
                <Loader2 className="size-4 animate-spin text-emerald-600" />
            ) : (
                <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{selectedIds.length > 0 ? `${label} (${selectedIds.length})` : label}</span>
        </Button>
    );
}

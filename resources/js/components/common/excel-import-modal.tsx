import React, { useState, useRef } from 'react';
import { useForm, router, usePage } from '@inertiajs/react';
import {
    Upload,
    FileSpreadsheet,
    Download,
    CheckCircle2,
    AlertCircle,
    Loader2,
    X,
    FileUp,
    RefreshCw,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FailureRecord {
    row: number;
    errors: string[];
}

interface ImportResult {
    created: number;
    updated: number;
    failures: FailureRecord[];
}

interface ExcelImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    importUrl: string;
    templateUrl: string;
    entityName: string;
}

export default function ExcelImportModal({
    isOpen,
    onClose,
    title,
    description,
    importUrl,
    templateUrl,
    entityName,
}: ExcelImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (
                file.name.endsWith('.xlsx') ||
                file.name.endsWith('.xls') ||
                file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.type === 'application/vnd.ms-excel'
            ) {
                setSelectedFile(file);
                setImportResult(null);
            } else {
                toast.error('Please select a valid Excel file (.xlsx or .xls)');
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                setSelectedFile(file);
                setImportResult(null);
            } else {
                toast.error('Please select a valid Excel file (.xlsx or .xls)');
            }
        }
    };

    const handleUpload = () => {
        if (!selectedFile) {
            toast.error('Please select an Excel file to upload.');
            return;
        }

        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);

        router.post(importUrl, formData, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page: any) => {
                setIsUploading(false);
                const result = page.props?.flash?.import_result;
                if (result) {
                    setImportResult(result);
                } else {
                    toast.success(`${entityName} imported successfully.`);
                    handleClose();
                }
            },
            onError: (errors) => {
                setIsUploading(false);
                const errorMsg = Object.values(errors).flat().join(' ') || 'Failed to import file. Please check file format.';
                toast.error(errorMsg);
            },
        });
    };

    const handleClose = () => {
        setSelectedFile(null);
        setImportResult(null);
        setIsUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
                <DialogHeader className="space-y-1 pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                            <FileSpreadsheet className="size-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                {title}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                                {description}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-3 flex-1 overflow-y-auto space-y-4 pr-1">
                    {/* Template download card */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-medium">
                                <Download className="size-4" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    Need the format template?
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Download a blank .xlsx file with all required headers.
                                </p>
                            </div>
                        </div>
                        <a
                            href={templateUrl}
                            download
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors shadow-2xs"
                        >
                            <Download className="size-3.5" />
                            <span>Template</span>
                        </a>
                    </div>

                    {/* Drag and Drop / File Selector */}
                    {!importResult && (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                                isDragging
                                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                                    : selectedFile
                                    ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/10'
                                    : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/40 dark:bg-zinc-900/30'
                            }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                className="hidden"
                            />

                            {selectedFile ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                        <FileSpreadsheet className="size-6" />
                                    </div>
                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        {selectedFile.name}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {(selectedFile.size / 1024).toFixed(1)} KB — Ready to upload
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFile(null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        className="mt-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 px-2"
                                    >
                                        <X className="size-3.5 mr-1" />
                                        Remove file
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="size-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center">
                                        <FileUp className="size-6" />
                                    </div>
                                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                        Click to browse or drag & drop .xlsx file
                                    </div>
                                    <div className="text-xs text-zinc-400 dark:text-zinc-500">
                                        Supports Microsoft Excel (.xlsx, .xls) up to 10MB
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Import Results Summary */}
                    {importResult && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-center">
                                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                                        Created
                                    </span>
                                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                                        {importResult.created}
                                    </span>
                                </div>

                                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-center">
                                    <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">
                                        Updated
                                    </span>
                                    <span className="text-xl font-bold text-blue-700 dark:text-blue-400">
                                        {importResult.updated}
                                    </span>
                                </div>

                                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-center">
                                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                                        Skipped / Errors
                                    </span>
                                    <span className="text-xl font-bold text-amber-700 dark:text-amber-400">
                                        {importResult.failures.length}
                                    </span>
                                </div>
                            </div>

                            {importResult.failures.length > 0 && (
                                <div className="mt-3 border border-red-200 dark:border-red-900/60 rounded-xl overflow-hidden">
                                    <div className="bg-red-50/80 dark:bg-red-950/40 px-3 py-2 border-b border-red-200 dark:border-red-900/60 flex items-center gap-2">
                                        <AlertCircle className="size-4 text-red-600 dark:text-red-400" />
                                        <span className="text-xs font-semibold text-red-800 dark:text-red-300">
                                            Row Errors ({importResult.failures.length})
                                        </span>
                                    </div>
                                    <div className="max-h-44 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 text-xs">
                                        {importResult.failures.map((failure, i) => (
                                            <div key={i} className="p-2.5 flex items-start gap-2">
                                                <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                                                    Row {failure.row}
                                                </span>
                                                <div className="text-zinc-600 dark:text-zinc-300 flex-1">
                                                    {failure.errors.join(', ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 gap-2 sm:gap-0 flex-row justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isUploading}
                    >
                        {importResult ? 'Close' : 'Cancel'}
                    </Button>

                    {!importResult && (
                        <Button
                            type="button"
                            onClick={handleUpload}
                            disabled={!selectedFile || isUploading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 ml-2"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    <span>Importing...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="size-4" />
                                    <span>Start Import</span>
                                </>
                            )}
                        </Button>
                    )}

                    {importResult && (
                        <Button
                            type="button"
                            onClick={() => {
                                setSelectedFile(null);
                                setImportResult(null);
                            }}
                            variant="secondary"
                            className="ml-2 gap-1.5"
                        >
                            <RefreshCw className="size-3.5" />
                            <span>Import Another File</span>
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

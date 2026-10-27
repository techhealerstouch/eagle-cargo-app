<?php

namespace App\Rules;

use App\Models\DataIntegrityWarning;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Translation\PotentiallyTranslatedString;

class SecureFile implements ValidationRule
{
    /**
     * Dangerous or executable extensions that should never appear in upload filenames,
     * either as the final extension or as an intermediate extension in a multi-extension attack.
     */
    private const DANGEROUS_EXTENSIONS = [
        // PHP scripts and variants
        'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'pht', 'phtml', 'phar', 'phps', 'pgif',
        // Executables, system binaries, batch and command scripts
        'exe', 'dll', 'so', 'sh', 'bash', 'bin', 'bat', 'cmd', 'com', 'msi', 'msp', 'scr', 'cpl',
        // Interpreted scripts
        'cgi', 'pl', 'py', 'pyc', 'pyw', 'rb', 'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1',
        'js', 'jsp', 'jspx', 'jar', 'war',
        // ASP / Windows server scripts
        'asp', 'aspx', 'cer', 'csr', 'asa', 'asax', 'hta',
        // Web server configuration files
        'htaccess', 'htpasswd', 'env', 'config',
    ];

    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! $value instanceof UploadedFile) {
            return;
        }

        $filename = $value->getClientOriginalName();
        $userId = request()->user()?->getAuthIdentifier();

        // Prevent path traversal or null bytes in uploaded filename
        if (str_contains($filename, "\0") || str_contains($filename, '..')) {
            Log::warning('Malicious file upload attempt: path traversal or null byte detected.', [
                'filename' => $filename,
                'ip' => request()->ip(),
                'user_id' => $userId,
            ]);
            $this->recordSecurityIncident(
                filename: $filename,
                signal: 'path_traversal',
                message: 'Suspicious file upload was blocked because of path traversal or invalid characters.',
                userId: $userId,
            );
            $fail('The :attribute contains invalid characters.');

            return;
        }

        // Prevent multiple extensions concealing dangerous/executable code (e.g., shell.php.jpg, statement.pdf.exe)
        $parts = explode('.', $filename);
        if (count($parts) > 1) {
            $extensions = array_slice($parts, 1);
            $hasDangerousExtension = false;
            $dangerousExtFound = '';

            foreach ($extensions as $ext) {
                $normalized = strtolower(trim($ext));
                if (in_array($normalized, self::DANGEROUS_EXTENSIONS, true)) {
                    $hasDangerousExtension = true;
                    $dangerousExtFound = $normalized;
                    break;
                }
            }

            if ($hasDangerousExtension) {
                $isMultiple = count($parts) > 2;
                $signal = $isMultiple ? 'multiple_extensions' : 'dangerous_extension';
                $message = $isMultiple
                    ? 'Suspicious file upload was blocked because it used multiple file extensions.'
                    : 'Suspicious file upload was blocked because it used a dangerous executable file extension.';

                Log::warning("Suspicious file upload attempt: {$signal} detected.", [
                    'filename' => $filename,
                    'dangerous_extension' => $dangerousExtFound,
                    'ip' => request()->ip(),
                    'user_id' => $userId,
                ]);
                $this->recordSecurityIncident(
                    filename: $filename,
                    signal: $signal,
                    message: $message,
                    userId: $userId,
                );
                $fail($isMultiple
                    ? 'The :attribute must not contain multiple extensions.'
                    : 'The :attribute contains an unsafe file extension.');

                return;
            }
        }

        // Prevent PHP scripts embedded in images (polyglot files)
        $content = file_get_contents($value->getRealPath()) ?: '';
        if (str_contains($content, '<?php') || str_contains($content, '<?=')) {
            Log::warning('Malicious file upload attempt: PHP content embedded in file.', [
                'filename' => $filename,
                'ip' => request()->ip(),
                'user_id' => $userId,
            ]);
            $this->recordSecurityIncident(
                filename: $filename,
                signal: 'embedded_php',
                message: 'Potentially malicious file upload was blocked because it contained PHP code.',
                userId: $userId,
            );
            $fail('The :attribute contains potentially malicious content.');
        }
    }

    private function recordSecurityIncident(string $filename, string $signal, string $message, ?int $userId): void
    {
        try {
            DataIntegrityWarning::create([
                'type' => 'suspicious_file_upload',
                'severity' => 'high',
                'message' => $message,
                'metadata' => [
                    'filename' => $filename,
                    'signal' => $signal,
                    'user_id' => $userId,
                    'ip_address' => request()->ip(),
                    'recommended_action' => 'Review the upload attempt and confirm the source account has not been compromised.',
                    'severity_reason' => 'The application blocked a file pattern commonly used to conceal executable or server-side code.',
                ],
            ]);
        } catch (\Throwable $exception) {
            Log::error('Unable to record suspicious file upload incident.', [
                'exception' => $exception->getMessage(),
            ]);
        }
    }
}

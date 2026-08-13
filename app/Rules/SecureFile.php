<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Translation\PotentiallyTranslatedString;

class SecureFile implements ValidationRule
{
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

        // Prevent multiple extensions (e.g., shell.php.jpg)
        if (substr_count($filename, '.') > 1) {
            Log::warning('Suspicious file upload attempt: multiple extensions detected.', [
                'filename' => $filename,
                'ip' => request()->ip(),
                'user_id' => $userId,
            ]);
            $fail('The :attribute must not contain multiple extensions.');
        }

        // Prevent PHP scripts embedded in images (polyglot files)
        $content = file_get_contents($value->getRealPath());
        if (str_contains($content, '<?php') || str_contains($content, '<?=')) {
            Log::warning('Malicious file upload attempt: PHP content embedded in file.', [
                'filename' => $filename,
                'ip' => request()->ip(),
                'user_id' => $userId,
            ]);
            $fail('The :attribute contains potentially malicious content.');
        }
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EnquiryController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_read' => ['nullable', 'string', 'in:all,read,unread'],
        ]);

        $query = Enquiry::query();

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function ($enquiryQuery) use ($search) {
                $enquiryQuery
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('mobile', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%");
            });
        }

        if (! empty($validated['is_read']) && $validated['is_read'] !== 'all') {
            $query->where('is_read', $validated['is_read'] === 'read');
        }

        $enquiries = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('admin/enquiries/index', [
            'enquiries' => $enquiries,
            'filters' => $request->only(['search', 'is_read']),
        ]);
    }

    public function show(Enquiry $enquiry)
    {
        if (! $enquiry->is_read) {
            $enquiry->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
        }

        return Inertia::render('admin/enquiries/show', [
            'enquiry' => $enquiry,
        ]);
    }

    public function update(Request $request, Enquiry $enquiry)
    {
        $validated = $request->validate([
            'admin_notes' => 'nullable|string',
            'replied_at' => 'nullable|date',
            'is_read' => 'nullable|boolean',
        ]);

        $enquiry->update($validated);

        return redirect()->route('admin.enquiries.index')->with('success', 'Enquiry updated successfully.');
    }

    public function destroy(Enquiry $enquiry)
    {
        $enquiry->delete();

        return redirect()->route('admin.enquiries.index')->with('success', 'Enquiry deleted successfully.');
    }
}

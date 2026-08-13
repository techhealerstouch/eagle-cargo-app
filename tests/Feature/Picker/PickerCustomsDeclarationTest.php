<?php

namespace Tests\Feature\Picker;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PickerCustomsDeclarationTest extends TestCase
{
    use RefreshDatabase;

    public function test_picker_can_upload_physical_declaration_form()
    {
        Storage::fake('local');

        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'declaration_form_status' => 'missing',
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
        ]);
        $runsheet->bookings()->attach($booking->id);

        $file = UploadedFile::fake()->image('customs_declaration.jpg');

        $response = $this->actingAs($picker)
            ->post(route('picker.box.upload-declaration', $box), [
                'declaration_form' => $file,
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $booking->refresh();
        $this->assertEquals('physical_copy_received', $booking->declaration_form_status);
        $this->assertNotNull($booking->declaration_form_path);

        Storage::disk('local')->assertExists($booking->declaration_form_path);
    }

    public function test_admin_can_view_uploaded_declaration_file()
    {
        Storage::fake('local');

        $admin = User::factory()->create(['role' => Role::Admin]);

        $file = UploadedFile::fake()->create('declaration.pdf', 100, 'application/pdf');

        $booking = Booking::factory()->create([
            'declaration_form_status' => 'physical_copy_received',
        ]);

        // Upload using Repository
        app(\App\Repositories\Contracts\TrackingRepositoryInterface::class)->uploadDeclaration(
            $booking->id,
            $file,
            'physical_copy_received'
        );

        $booking->refresh();

        $response = $this->actingAs($admin)
            ->get(route('admin.bookings.declaration.file', $booking));

        $response->assertStatus(200);
        $this->assertEquals('application/pdf', $response->headers->get('Content-Type'));
    }

    public function test_non_admin_cannot_view_uploaded_declaration_file()
    {
        Storage::fake('local');

        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'declaration_form_status' => 'physical_copy_received',
            'declaration_form_path' => 'declarations/BK-2026-001/doc.pdf',
        ]);

        Storage::disk('local')->put('declarations/BK-2026-001/doc.pdf', 'dummy content');

        $response = $this->actingAs($picker)
            ->get(route('admin.bookings.declaration.file', $booking));

        $response->assertStatus(403);
    }
}

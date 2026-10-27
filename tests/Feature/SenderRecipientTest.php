<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Area;
use App\Models\Province;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SenderRecipientTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    #[Test]
    public function it_passes_active_provinces_to_edit_recipient_page(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Sender->value]);
        $sender = Sender::factory()->create(['user_id' => $user->id]);
        $user->setRelation('sender', $sender);

        $area = Area::firstOrCreate(['name' => 'Inter-Island'], ['is_active' => true]);
        $province = Province::firstOrCreate(
            ['name' => 'Romblon'],
            ['area_id' => $area->id, 'is_active' => true]
        );

        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'province' => $province->name,
            'city' => 'Odiongan',
        ]);

        $response = $this->actingAs($user)->get(route('sender.recipients.edit', $recipient));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('sender/EditRecipient')
                ->has('recipient')
                ->has('areas')
                ->has('provinces')
            );
    }

    #[Test]
    public function it_auto_resolves_area_id_from_province_when_updating_recipient(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Sender->value]);
        $sender = Sender::factory()->create(['user_id' => $user->id]);
        $user->setRelation('sender', $sender);

        $manilaArea = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $romblonArea = Area::firstOrCreate(['name' => 'Inter-Island'], ['is_active' => true]);

        Province::firstOrCreate(
            ['name' => 'Romblon'],
            ['area_id' => $romblonArea->id, 'is_active' => true]
        );

        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $manilaArea->id,
            'province' => 'Metro Manila',
            'city' => 'Manila',
        ]);

        // Submit update with province = Romblon, without area_id
        $response = $this->actingAs($user)->put(route('sender.recipients.update', $recipient), [
            'name' => 'Maria Updated',
            'address' => 'Barangay Poctoy',
            'city' => 'Odiongan',
            'province' => 'Romblon',
            'phone_number' => '09171234567',
        ]);

        $response->assertRedirect(route('sender.recipients.index'));

        $recipient->refresh();
        $this->assertEquals('Maria Updated', $recipient->name);
        $this->assertEquals('Romblon', $recipient->province);
        $this->assertEquals($romblonArea->id, $recipient->area_id);
    }
}

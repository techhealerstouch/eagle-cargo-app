<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Models\Batch;
use App\Models\PickupZone;
use App\Models\Suburb;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicScheduleAndRateTest extends TestCase
{
    public function test_welcome_page_renders_with_rate_calculator_and_schedule_props(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('welcome')
            ->has('areas')
            ->has('provinces')
            ->has('boxTypes')
            ->has('boxPrices')
            ->has('pickupZones')
            ->has('suburbs')
            ->has('upcomingBatches')
        );
    }

    public function test_services_page_renders_with_rate_calculator_and_schedule_props(): void
    {
        $response = $this->get('/services');

        $response->assertStatus(200);
        $response->assertInertia(fn (Assert $page) => $page
            ->component('marketing/services')
            ->has('areas')
            ->has('provinces')
            ->has('boxTypes')
            ->has('boxPrices')
            ->has('pickupZones')
            ->has('suburbs')
            ->has('upcomingBatches')
        );
    }
}

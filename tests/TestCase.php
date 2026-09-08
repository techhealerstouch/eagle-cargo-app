<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = parent::createApplication();

        // Strictly enforce that all tests run against eagle_cargo_test
        config(['database.connections.mysql.database' => 'eagle_cargo_test']);
        \Illuminate\Support\Facades\DB::purge('mysql');

        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();

        $currentDb = config('database.connections.mysql.database');
        if ($currentDb === 'eagle_cargo_db') {
            throw new \RuntimeException("SAFETY ABORT: Tests must not run against the development database [{$currentDb}]! Use eagle_cargo_test instead.");
        }
    }

    protected function skipUnlessFortifyFeature(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}

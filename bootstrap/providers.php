<?php

use App\Providers\AppServiceProvider;
use App\Providers\FortifyServiceProvider;
use App\Providers\TelescopeServiceProvider;

return array_filter([
    App\Providers\AppServiceProvider::class,
    App\Providers\FortifyServiceProvider::class,
    class_exists(\Laravel\Telescope\TelescopeApplicationServiceProvider::class) ? App\Providers\TelescopeServiceProvider::class : null,
]);

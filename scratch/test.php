<?php

enum BoxStatus: string {
    case Pending = 'pending';
    case Collected = 'collected';
}

require 'vendor/autoload.php';

$boxes = collect([ (object)['status' => BoxStatus::Pending] ]);
var_dump($boxes->whereIn('status', [BoxStatus::Pending->value])->count());

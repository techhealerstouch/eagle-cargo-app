<?php

namespace App\Concerns;

trait NormalizesNotes
{
    /**
     * Boot the trait and register model events.
     */
    protected static function bootNormalizesNotes(): void
    {
        static::saving(function ($model) {
            $noteFields = ['admin_notes', 'courier_notes', 'notes'];

            foreach ($noteFields as $field) {
                if (array_key_exists($field, $model->getAttributes())) {
                    if (empty($model->{$field})) {
                        $model->{$field} = null;
                    }
                }
            }
        });
    }
}

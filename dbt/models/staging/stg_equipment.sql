with source as (
    select * from {{ source('fitdata_raw', 'equipment_types') }}
),

renamed as (
    select
        id as equipment_id,
        name as equipment_name
    from source
)

select * from renamed


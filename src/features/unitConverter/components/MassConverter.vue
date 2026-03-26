<template>
  <BaseUnitConverter
    :units="MASS_UNITS"
    default-from="kilogram"
    default-to="gram"
  />
</template>

<script setup lang="ts">
import BaseUnitConverter from './BaseUnitConverter.vue'
import { MASS_UNITS } from '../utils/units'
</script>

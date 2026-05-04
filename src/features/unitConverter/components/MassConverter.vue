<template>
  <BaseUnitConverter
    :units="MASS_UNITS"
    default-from="kilogram"
    default-to="gram"
  />
</template>

<script setup lang="ts">
import { MASS_UNITS } from "../utils/units"
import BaseUnitConverter from "./BaseUnitConverter.vue"
</script>

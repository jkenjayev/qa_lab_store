import { filterAndSortDoctors } from '../domain/doctorQuery.js';
import { NotFoundError } from '../domain/errors.js';
import { SPECIALTIES } from '../data/seed.js';
import { formatDate } from '../shared/time.js';

/** Doctor directory. */
export class DoctorService {
  constructor({ doctors, slots, defects }) {
    Object.assign(this, { doctors, slots, defects });
  }

  specialties() {
    return [...SPECIALTIES];
  }

  #view(doctor) {
    const next = this.slots.nextAvailable(doctor.id) ?? '9999-12-31';
    return {
      ...doctor,
      nextAvailable: next,
      nextAvailableText: next === '9999-12-31' ? 'Boʻsh vaqt yoʻq' : formatDate(next),
      initials: doctor.name.replace('Dr. ', '').split(' ').map((p) => p[0]).join(''),
    };
  }

  list({ specialty = '', name = '', sort = 'next' } = {}) {
    const all = this.doctors.list().map((d) => this.#view(d));
    return filterAndSortDoctors(all, { specialty, name, sort }, this.defects);
  }

  get(id) {
    const doctor = this.doctors.get(id);
    if (!doctor) throw new NotFoundError(`Shifokor ${id} topilmadi`);
    return this.#view(doctor);
  }
}

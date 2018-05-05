/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directive, ElementRef, Injectable, Injector, Input, OnDestroy, OnInit, Renderer2, forwardRef} from '@angular/core';

import {AbstractControl, FormArray} from '../model';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from './control_value_accessor';
import {NgControl} from './ng_control';

export const RADIO_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => RadioControlValueAccessor),
  multi: true
};

/**
 * Internal class used by Angular to uncheck radio buttons with the matching name.
 */
@Injectable()
export class RadioControlRegistry {
  private _accessors: any[] = [];

  add(control: NgControl, accessor: RadioControlValueAccessor) {
    this._accessors.push([control, accessor]);
  }

  remove(accessor: RadioControlValueAccessor) {
    for (let i = this._accessors.length - 1; i >= 0; --i) {
      if (this._accessors[i][1] === accessor) {
        this._accessors.splice(i, 1);
        return;
      }
    }
  }

  select(accessor: RadioControlValueAccessor) {
    this._accessors.forEach((c) => {
      if (this._isSameGroup(c, accessor) && c[1] !== accessor) {
        c[1].fireUncheck(accessor.value);
      }
    });
  }

  private _isSameGroup(
      controlPair: [NgControl, RadioControlValueAccessor],
      accessor: RadioControlValueAccessor): boolean {
    if (!controlPair[0].control) return false;
    return controlPair[0]._parent === accessor._control._parent &&
        controlPair[1].name === accessor.name;
  }
}

/**
 * @description
 *
 * Writes radio control values and listens to radio control changes.
 *
 * Used by `NgModel`, `FormControlDirective`, and `FormControlName`
 * to keep the view synced with the `FormControl` model.
 *
 * If you have imported the `FormsModule` or the `ReactiveFormsModule`, this
 * value accessor will be active on any radio control that has a form directive. You do
 * **not** need to add a special selector to activate it.
 *
 * ### How to use radio buttons with form directives
 *
 * To use radio buttons in a template-driven form, you'll want to ensure that radio buttons
 * in the same group have the same `name` attribute.  Radio buttons with different `name`
 * attributes do not affect each other.
 *
 * {@example forms/ts/radioButtons/radio_button_example.ts region='TemplateDriven'}
 *
 * When using radio buttons in a reactive form, radio buttons in the same group should have the
 * same `formControlName`. You can also add a `name` attribute, but it's optional.
 *
 * {@example forms/ts/reactiveRadioButtons/reactive_radio_button_example.ts region='Reactive'}
 *
 *  * **npm package**: `@angular/forms`
 *
 *
 */
@Directive({
  selector:
      'input[type=radio][formControlName],input[type=radio][formControl],input[type=radio][ngModel]',
  host: {'(change)': 'onChange()', '(blur)': 'onTouched()'},
  providers: [RADIO_VALUE_ACCESSOR]
})
export class RadioControlValueAccessor implements ControlValueAccessor,
    OnDestroy, OnInit {
  /** @internal */
  _state: boolean;
  /** @internal */
  _control: NgControl;
  /** @internal */
  _fn: Function;
  onChange = () => {};
  onTouched = () => {};

  @Input() name: string;
  @Input() formControlName: string;
  @Input() value: any;

  constructor(
      private _renderer: Renderer2, private _elementRef: ElementRef,
      private _registry: RadioControlRegistry, private _injector: Injector) {}

  ngOnInit(): void {
    this._control = this._injector.get(NgControl);
    this._checkName();
    this._registry.add(this._control, this);
  }

  ngOnDestroy(): void { this._registry.remove(this); }

  writeValue(value: any): void {
    this._state = value === this.value;
    this._renderer.setProperty(this._elementRef.nativeElement, 'checked', this._state);
  }

  registerOnChange(fn: (_: any) => {}): void {
    this._fn = fn;
    this.onChange = () => {
      fn(this.value);
      this._registry.select(this);
    };
  }

  fireUncheck(value: any): void { this.writeValue(value); }

  registerOnTouched(fn: () => {}): void { this.onTouched = fn; }

  setDisabledState(isDisabled: boolean): void {
    this._renderer.setProperty(this._elementRef.nativeElement, 'disabled', isDisabled);
  }

  private _checkName(): void {
    if (this.name && this.formControlName && this.name !== this._parsedName) {
      this._throwNameError(this.name, this._parsedName);
    }
    if (!this.name && this.formControlName) this.name = this._parsedName;
  }

  private get _parsedName(): string {
    if (!this._control._parent || !this._control.path || !this._control.path.length) {
      return this.formControlName;
    }

    let path = this._control.path;
    // Make sure the last element is set to this formControlName
    if (path[path.length - 1] == null) {
      path[path.length - 1] = this.formControlName;
    }

    // Get control ancestors
    let ancestors: AbstractControl[] = [];
    let ancestor: AbstractControl | null = this._control._parent.control;
    while (ancestor && ancestor.parent) {
      ancestors.push(ancestor);
      ancestor = ancestor.parent;
    }
    ancestors.reverse();

    // Match ancestors with path names, and check if ancestor is a FormArray
    let parsedAncestors: { name: string, isArray: boolean}[] = [];
    for (let i = 0; i < path.length; i++) {
      ancestor = ancestors[i];
      parsedAncestors.push({ name: path[i], isArray: ancestor && (<FormArray>ancestor).at && true });
    }

    // Parse name with FormArray indexes in square brackets
    let parsedName: string = "";
    let isPreviousAncestorArray: boolean = false;
    for (let parsedAncestor of parsedAncestors) {
      if (isPreviousAncestorArray) parsedName += `[${parsedAncestor.name}]`;
      else parsedName += `${parsedName ? "." : ""}${parsedAncestor.name}`;

      isPreviousAncestorArray = parsedAncestor.isArray;
    }

    return parsedName;
  }

  private _throwNameError(formControlName: string, parsedName: string): void {
    throw new Error(`
      If you define both a name and a formControlName attribute on your radio button,
      the name must match the form control path.
      Ex: <input type="radio" formControlName="${formControlName}" name="${parsedName}">
    `);
  }
}

import { Component, Input, forwardRef, ViewChild, ElementRef, OnDestroy, EventEmitter, Output, NgZone } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

import { ScriptService } from './script.service';
declare var window: any;
declare var UE: any;

@Component({
    selector: 'ueditor',
    template: `
    <textarea #host class="ueditor-textarea"></textarea>
    <p class="loading" *ngIf="loading">{{loadingTip}}</p>
    `,
    styles: [ `.ueditor-textarea{display:none;}` ],
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => UeditorComponent),
        multi: true
    }],
})
export class UeditorComponent implements OnDestroy, ControlValueAccessor {
    private instance: any;
    private value: string;
    private events:any = {};
    
    loading: boolean = true;

    @Input() path: string;
    @Input() config: any;
    @Input() loadingTip: string = '加载中...';
    @ViewChild('host') host: ElementRef;

    @Output() onReady = new EventEmitter();
    @Output() onDestroy = new EventEmitter();
    @Output() onContentChange = new EventEmitter();

    constructor(private el: ElementRef,
                private zone: NgZone, 
                private ss: ScriptService) { }

    ngOnInit() {
        if (!this.path) this.path = './assets/ueditor/';

        // 已经存在对象无须进入懒加载模式
        if (window.UE) {
            this.init();
            return;
        }

        this.ss.load(this.path, true).getChangeEmitter().subscribe(res => {
            this.init();
        });
    }

    private init(options?: any) {
        this.loading = false;
        if (!window.UE)
            throw new Error('uedito js文件加载失败');

        if (this.instance) return;

        let ueditor = new UE.ui.Editor(Object.assign({
            UEDITOR_HOME_URL: this.path
        }, this.config, options));
        ueditor.render(this.host.nativeElement);
        
        ueditor.addListener('ready', () => {
            this.instance = ueditor;
            this.value && this.instance.setContent(this.value);
            this.onReady.emit();
        });
        
        ueditor.addListener('contentChange', () => {
            this.updateValue(ueditor.getContent());
        });
    }

    private updateValue(value: string){
        this.zone.run(() => {
            this.value = value;

            this.onChange(this.value);
            this.onTouched(this.value);
            
            this.onContentChange.emit(this.value);
        });
    }

    private destroy() {
        if (this.instance) {
            for (let ki of this.events) {
                this.instance.removeListener(ki, this.events[ki]);
            }
            this.instance.removeListener('ready');
            this.instance.removeListener('contentChange');
            this.instance.destroy();
            this.instance = null;
        }
        this.onDestroy.emit();
    }

    /**
     * 获取UE实例
     * 
     * @readonly
     */
    get Instance(): any {
        return this.instance;
    }

    /**
     * 设置编辑器语言
     * 
     * @param {('zh-cn' | 'en')} lang 
     */
    setLanguage(lang: 'zh-cn' | 'en') {
        this.ss.loadScript(`${this.path}/lang/${lang}/${lang}.js`).then(res => {
            this.destroy();

            //清空语言
            if (!UE._bak_I18N) {
                UE._bak_I18N = UE.I18N;
            }
            UE.I18N = {};
            UE.I18N[lang] = UE._bak_I18N[ lang ];

            this.init();
        });
    }

    /**
     * 添加编辑器事件
     * 
     * @param {('destroy' | 'reset' | 'focus' | 'langReady' | 'beforeExecCommand' | 'afterExecCommand' | 'firstBeforeExecCommand' | 'beforeGetContent' | 'afterGetContent' | 'getAllHtml' | 'beforeSetContent' | 'afterSetContent' | 'selectionchange' | 'beforeSelectionChange' | 'afterSelectionChange')} eventName 
     * @param {Function} fn 
     */
    addListener(eventName: 'destroy' | 'reset' | 'focus' | 'langReady' | 'beforeExecCommand' | 'afterExecCommand' | 'firstBeforeExecCommand' | 'beforeGetContent' | 'afterGetContent' | 'getAllHtml' | 'beforeSetContent' | 'afterSetContent' | 'selectionchange' | 'beforeSelectionChange' | 'afterSelectionChange', 
                fn: Function): void {
        if (this.events[eventName]) return;
        this.events[eventName] = fn;
        this.instance.addListener(eventName, fn);
    }

    /**
     * 移除编辑器事件
     * 
     * @param {('destroy' | 'reset' | 'focus' | 'langReady' | 'beforeExecCommand' | 'afterExecCommand' | 'firstBeforeExecCommand' | 'beforeGetContent' | 'afterGetContent' | 'getAllHtml' | 'beforeSetContent' | 'afterSetContent' | 'selectionchange' | 'beforeSelectionChange' | 'afterSelectionChange')} eventName 
     */
    removeListener(eventName: 'destroy' | 'reset' | 'focus' | 'langReady' | 'beforeExecCommand' | 'afterExecCommand' | 'firstBeforeExecCommand' | 'beforeGetContent' | 'afterGetContent' | 'getAllHtml' | 'beforeSetContent' | 'afterSetContent' | 'selectionchange' | 'beforeSelectionChange' | 'afterSelectionChange'): void {
        if (!this.events[eventName]) return;
        this.instance.removeListener(eventName, this.events[eventName]);
        delete this.events[eventName];
    }

    ngOnDestroy() {
        this.destroy();
    }

    writeValue(value: string): void {
        this.value = value;
        if(this.instance){
            this.instance.setContent(this.value);
        }
    }

    protected onChange: any = Function.prototype;
    protected onTouched: any = Function.prototype;

    public registerOnChange(fn: (_: any) => {}): void { this.onChange = fn; }
    public registerOnTouched(fn: () => {}): void { this.onTouched = fn; }

    setDisabledState(isDisabled: boolean): void {
        if (isDisabled) {
            this.instance.setDisabled();
        } else {
            this.instance.setEnabled();
        }
    }
}
